import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const app = express();
const port = 3000;
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const pythonExecutable = process.env.PYTHON_EXECUTABLE || "python";
const dataDirectory = path.join(currentDirectory, "data");
const usersFile = path.join(dataDirectory, "users.json");
const chatRoomsFile = path.join(dataDirectory, "chat-rooms.json");
const qnaFile = path.join(dataDirectory, "qna.json");
const chatRooms = new Map();
const httpServer = createServer(app);
const webSocketServer = new WebSocketServer({
  server: httpServer,
  path: "/ws",
});

app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);
app.use(express.json());
app.use(express.static(currentDirectory));

async function readQna() {
  try {
    return JSON.parse(await fs.readFile(qnaFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return [];
  }
}

async function writeQna(posts) {
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(qnaFile, JSON.stringify(posts, null, 2), "utf8");
}

app.get("/api/qna/posts", async (request, response) => {
  try {
    response.json(await readQna());
  } catch {
    response.status(500).json({ error: "게시글을 불러오지 못했습니다." });
  }
});

app.post("/api/qna/posts", async (request, response) => {
  const title =
    typeof request.body?.title === "string" ? request.body.title.trim() : "";
  const content =
    typeof request.body?.content === "string"
      ? request.body.content.trim()
      : "";
  const author =
    typeof request.body?.author === "string"
      ? request.body.author.trim()
      : "익명";

  if (!title || title.length > 100 || !content || content.length > 2000) {
    response
      .status(400)
      .json({ error: "제목과 내용을 올바르게 입력해주세요." });
    return;
  }

  try {
    const posts = await readQna();
    const post = {
      id: crypto.randomUUID(),
      title,
      content,
      author: author.slice(0, 20) || "익명",
      createdAt: new Date().toISOString(),
      comments: [],
    };
    posts.unshift(post);
    await writeQna(posts);
    response.status(201).json(post);
  } catch {
    response.status(500).json({ error: "게시글을 저장하지 못했습니다." });
  }
});

app.post("/api/qna/posts/:postId/comments", async (request, response) => {
  const content =
    typeof request.body?.content === "string"
      ? request.body.content.trim()
      : "";
  const author =
    typeof request.body?.author === "string"
      ? request.body.author.trim()
      : "익명";
  if (!content || content.length > 1000) {
    response
      .status(400)
      .json({ error: "댓글을 1자 이상 1000자 이하로 입력해주세요." });
    return;
  }

  try {
    const posts = await readQna();
    const post = posts.find((item) => item.id === request.params.postId);
    if (!post) {
      response.status(404).json({ error: "게시글을 찾을 수 없습니다." });
      return;
    }

    const comment = {
      id: crypto.randomUUID(),
      content,
      author: author.slice(0, 20) || "익명",
      createdAt: new Date().toISOString(),
    };
    post.comments.push(comment);
    await writeQna(posts);
    response.status(201).json(comment);
  } catch {
    response.status(500).json({ error: "댓글을 저장하지 못했습니다." });
  }
});

async function loadChatRooms() {
  try {
    const savedRooms = JSON.parse(await fs.readFile(chatRoomsFile, "utf8"));
    for (const room of savedRooms) {
      chatRooms.set(room.id, {
        id: room.id,
        name: room.name,
        clients: new Set(),
        messages: Array.isArray(room.messages) ? room.messages : [],
      });
    }
  } catch (error) {
    if (error.code !== "ENOENT") console.error("채팅방 불러오기 실패:", error);
  }
}

async function saveChatRooms() {
  await fs.mkdir(dataDirectory, { recursive: true });
  const savedRooms = [...chatRooms.values()].map((room) => ({
    id: room.id,
    name: room.name,
    messages: room.messages,
  }));
  await fs.writeFile(
    chatRoomsFile,
    JSON.stringify(savedRooms, null, 2),
    "utf8",
  );
}

app.get("/api/chat/rooms", (request, response) => {
  response.json(
    [...chatRooms.values()].map((room) => ({
      id: room.id,
      name: room.name,
      participantCount: room.clients.size,
      messageCount: room.messages.length,
    })),
  );
});

app.post("/api/chat/rooms", async (request, response) => {
  const name =
    typeof request.body?.name === "string" ? request.body.name.trim() : "";
  if (name.length < 1 || name.length > 40) {
    response
      .status(400)
      .json({ error: "채팅방 이름은 1자 이상 40자 이하로 입력해주세요." });
    return;
  }

  const room = {
    id: crypto.randomUUID(),
    name,
    clients: new Set(),
    messages: [],
  };
  chatRooms.set(room.id, room);
  await saveChatRooms();
  response.status(201).json({ id: room.id, name: room.name });
});

function broadcastRoom(room, payload) {
  const message = JSON.stringify(payload);
  for (const client of room.clients) {
    if (client.readyState === 1) client.send(message);
  }
}

webSocketServer.on("connection", (socket) => {
  let currentRoom;
  let nickname = "익명";

  socket.on("message", (rawMessage) => {
    try {
      const payload = JSON.parse(rawMessage.toString());

      if (payload.type === "join") {
        const room = chatRooms.get(payload.roomId);
        const requestedNickname =
          typeof payload.nickname === "string" ? payload.nickname.trim() : "";
        if (!room) {
          socket.send(
            JSON.stringify({
              type: "error",
              message: "존재하지 않는 채팅방입니다.",
            }),
          );
          return;
        }

        currentRoom?.clients.delete(socket);
        currentRoom = room;
        nickname = requestedNickname.slice(0, 20) || "익명";
        room.clients.add(socket);
        socket.send(
          JSON.stringify({
            type: "room-history",
            roomName: room.name,
            messages: room.messages,
          }),
        );
        broadcastRoom(room, {
          type: "system",
          message: `${nickname}님이 입장했습니다.`,
        });
        return;
      }

      if (payload.type === "message" && currentRoom) {
        const text =
          typeof payload.text === "string" ? payload.text.trim() : "";
        if (!text || text.length > 500) return;
        const chatMessage = {
          nickname,
          text,
          createdAt: new Date().toISOString(),
        };
        currentRoom.messages.push(chatMessage);
        if (currentRoom.messages.length > 100) currentRoom.messages.shift();
        saveChatRooms().catch((error) =>
          console.error("채팅 저장 실패:", error),
        );
        broadcastRoom(currentRoom, { type: "message", ...chatMessage });
      }
    } catch {
      socket.send(
        JSON.stringify({
          type: "error",
          message: "메시지 형식이 올바르지 않습니다.",
        }),
      );
    }
  });

  socket.on("close", () => {
    if (!currentRoom) return;
    currentRoom.clients.delete(socket);
    broadcastRoom(currentRoom, {
      type: "system",
      message: `${nickname}님이 퇴장했습니다.`,
    });
  });
});

async function readUsers() {
  try {
    return JSON.parse(await fs.readFile(usersFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return [];
  }
}

async function writeUsers(users) {
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2), "utf8");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function passwordMatches(password, user) {
  const candidate = Buffer.from(hashPassword(password, user.salt).hash, "hex");
  const saved = Buffer.from(user.passwordHash, "hex");
  return (
    candidate.length === saved.length &&
    crypto.timingSafeEqual(candidate, saved)
  );
}

app.post("/api/auth/signup", async (request, response) => {
  const username =
    typeof request.body?.username === "string"
      ? request.body.username.trim()
      : "";
  const password =
    typeof request.body?.password === "string" ? request.body.password : "";

  if (username.length < 2 || username.length > 20) {
    response
      .status(400)
      .json({ error: "사용자명은 2자 이상 20자 이하로 입력해주세요." });
    return;
  }
  if (password.length < 6) {
    response.status(400).json({ error: "비밀번호는 6자 이상 입력해주세요." });
    return;
  }

  try {
    const users = await readUsers();
    if (
      users.some(
        (user) => user.username.toLowerCase() === username.toLowerCase(),
      )
    ) {
      response.status(409).json({ error: "이미 사용 중인 사용자명입니다." });
      return;
    }

    const { salt, hash } = hashPassword(password);
    users.push({
      username,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString(),
    });
    await writeUsers(users);
    response.status(201).json({ message: "회원가입이 완료되었습니다." });
  } catch {
    response
      .status(500)
      .json({ error: "회원가입 처리 중 오류가 발생했습니다." });
  }
});

app.post("/api/auth/login", async (request, response) => {
  const username =
    typeof request.body?.username === "string"
      ? request.body.username.trim()
      : "";
  const password =
    typeof request.body?.password === "string" ? request.body.password : "";

  try {
    const users = await readUsers();
    const user = users.find(
      (item) => item.username.toLowerCase() === username.toLowerCase(),
    );
    if (!user || !passwordMatches(password, user)) {
      response
        .status(401)
        .json({ error: "사용자명 또는 비밀번호가 올바르지 않습니다." });
      return;
    }

    response.json({ message: "로그인되었습니다.", username: user.username });
  } catch {
    response.status(500).json({ error: "로그인 처리 중 오류가 발생했습니다." });
  }
});

app.get("/api/mypage", async (request, response) => {
  const username =
    typeof request.query.username === "string"
      ? request.query.username.trim()
      : "";
  if (!username) {
    response.status(400).json({ error: "사용자명이 필요합니다." });
    return;
  }

  try {
    const users = await readUsers();
    const user = users.find(
      (item) => item.username.toLowerCase() === username.toLowerCase(),
    );
    if (!user) {
      response.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      return;
    }

    const posts = await readQna();
    const authoredPosts = posts
      .filter(
        (post) => post.author.toLowerCase() === user.username.toLowerCase(),
      )
      .map(({ id, title, content, createdAt, comments }) => ({
        id,
        title,
        content,
        createdAt,
        commentCount: comments.length,
      }));
    const authoredComments = posts.flatMap((post) =>
      post.comments
        .filter(
          (comment) =>
            comment.author.toLowerCase() === user.username.toLowerCase(),
        )
        .map(({ id, content, createdAt }) => ({
          id,
          content,
          createdAt,
          postId: post.id,
          postTitle: post.title,
        })),
    );

    response.json({
      username: user.username,
      createdAt: user.createdAt,
      posts: authoredPosts,
      comments: authoredComments,
    });
  } catch {
    response
      .status(500)
      .json({ error: "마이페이지 정보를 불러오지 못했습니다." });
  }
});

app.get("/api/anime", (request, response) => {
  const query =
    typeof request.query.query === "string" ? request.query.query : "";
  const bridge = spawn(
    pythonExecutable,
    [path.join(currentDirectory, "laftel_bridge.py"), query],
    {
      windowsHide: true,
    },
  );
  let output = "";
  let errorOutput = "";

  bridge.stdout.on("data", (chunk) => {
    output += chunk;
  });
  bridge.stderr.on("data", (chunk) => {
    errorOutput += chunk;
  });
  bridge.on("error", (error) => {
    response.status(500).json({ error: `Python 실행 실패: ${error.message}` });
  });
  bridge.on("close", (exitCode) => {
    if (response.headersSent) return;
    if (exitCode !== 0) {
      response.status(502).json({
        error: errorOutput.trim() || "Laftel API 호출에 실패했습니다.",
      });
      return;
    }

    try {
      response.json(JSON.parse(output));
    } catch {
      response.status(502).json({ error: "Laftel 응답을 읽을 수 없습니다." });
    }
  });
});

await loadChatRooms();

httpServer.listen(port, () => {
  console.log(`JumpUp server: http://localhost:${port}`);
});
