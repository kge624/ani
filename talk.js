const roomList = document.querySelector("#room-list");
const roomStatus = document.querySelector("#room-status");
const createRoomButton = document.querySelector("#create-room-button");
const createRoomForm = document.querySelector("#create-room-form");
const roomNameInput = document.querySelector("#room-name-input");
const currentRoomName = document.querySelector("#current-room-name");
const connectionStatus = document.querySelector("#connection-status");
const chatMessages = document.querySelector("#chat-messages");
const chatForm = document.querySelector("#chat-form");
const messageInput = document.querySelector("#message-input");
const chatSubmit = chatForm.querySelector("button");
const apiBase = "http://localhost:3000";

async function readApiResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      "Node 서버 주소가 올바르지 않습니다. http://localhost:3000에서 실행해주세요.",
    );
  }
}
let socket;

function showRoomStatus(message) {
  roomStatus.textContent = message;
}

async function loadRooms() {
  try {
    const response = await fetch(`${apiBase}/api/chat/rooms`);
    const rooms = await readApiResponse(response);
    if (!rooms.length) {
      roomList.innerHTML =
        '<p class="empty-room">아직 만들어진 채팅방이 없습니다.</p>';
      return;
    }
    roomList.innerHTML = rooms
      .map(
        (room) => `
      <button class="room-item" type="button" data-room-id="${room.id}">
        <strong>${room.name}</strong>
        <span class="room-meta">${room.participantCount}명</span>
      </button>
    `,
      )
      .join("");
    roomList.querySelectorAll("[data-room-id]").forEach((button) => {
      button.addEventListener("click", () =>
        joinRoom(
          button.dataset.roomId,
          button.querySelector("strong").textContent,
        ),
      );
    });
  } catch {
    roomList.innerHTML =
      '<p class="empty-room">채팅방을 불러오지 못했습니다.</p>';
  }
}

function appendMessage(payload) {
  const message = document.createElement("div");
  message.className = payload.type === "system" ? "system-message" : "message";
  if (payload.type === "system") {
    message.textContent = payload.message;
  } else {
    const nickname = document.createElement("span");
    nickname.className = "nickname";
    nickname.textContent = payload.nickname;
    const text = document.createElement("span");
    text.className = "message-text";
    text.textContent = payload.text;
    message.append(nickname, text);
  }
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function joinRoom(roomId, roomName) {
  if (socket) socket.close();
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const socketUrl = `${protocol}://${window.location.hostname || "localhost"}:3000/ws`;
  socket = new WebSocket(socketUrl);
  currentRoomName.textContent = roomName;
  connectionStatus.textContent = "연결 중...";
  connectionStatus.classList.remove("connected");
  chatMessages.innerHTML = "";

  socket.addEventListener("open", () => {
    socket.send(
      JSON.stringify({
        type: "join",
        roomId,
        nickname: localStorage.getItem("jumpup_username") || "익명",
      }),
    );
    connectionStatus.textContent = "연결됨";
    connectionStatus.classList.add("connected");
    messageInput.disabled = false;
    chatSubmit.disabled = false;
    loadRooms();
  });
  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "room-history") {
      currentRoomName.textContent = payload.roomName;
      payload.messages.forEach((message) =>
        appendMessage({ type: "message", ...message }),
      );
    } else if (payload.type === "message" || payload.type === "system") {
      appendMessage(payload);
    } else if (payload.type === "error") {
      showRoomStatus(payload.message);
    }
  });
  socket.addEventListener("close", () => {
    connectionStatus.textContent = "연결 안 됨";
    connectionStatus.classList.remove("connected");
    messageInput.disabled = true;
    chatSubmit.disabled = true;
  });
}

createRoomButton.addEventListener("click", () => {
  createRoomForm.hidden = !createRoomForm.hidden;
  if (!createRoomForm.hidden) roomNameInput.focus();
});

createRoomForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const response = await fetch(`${apiBase}/api/chat/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: roomNameInput.value.trim() }),
    });
    const room = await readApiResponse(response);
    if (!response.ok) throw new Error(room.error);
    roomNameInput.value = "";
    createRoomForm.hidden = true;
    showRoomStatus("채팅방이 만들어졌습니다.");
    await loadRooms();
    joinRoom(room.id, room.name);
  } catch (error) {
    showRoomStatus(error.message || "채팅방을 만들 수 없습니다.");
  }
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!socket || socket.readyState !== WebSocket.OPEN || !text) return;
  socket.send(JSON.stringify({ type: "message", text }));
  messageInput.value = "";
  messageInput.focus();
});

loadRooms();
