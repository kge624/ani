const newPostButton = document.querySelector("#new-post-button");
const cancelPostButton = document.querySelector("#cancel-post-button");
const postForm = document.querySelector("#post-form");
const postTitle = document.querySelector("#post-title");
const postContent = document.querySelector("#post-content");
const postList = document.querySelector("#post-list");
const qnaStatus = document.querySelector("#qna-status");
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

function currentAuthor() {
  return localStorage.getItem("jumpup_username") || "익명";
}

function formatDate(value) {
  return new Date(value).toLocaleString("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function createComment(comment) {
  const element = document.createElement("article");
  element.className = "comment";
  const meta = document.createElement("p");
  meta.className = "comment-meta";
  meta.textContent = `${comment.author} · ${formatDate(comment.createdAt)}`;
  const content = document.createElement("p");
  content.className = "comment-content";
  content.textContent = comment.content;
  element.append(meta, content);
  return element;
}

function createPost(post) {
  const article = document.createElement("article");
  article.className = "post-card";
  const header = document.createElement("div");
  header.className = "post-header";
  const title = document.createElement("h3");
  title.textContent = post.title;
  const meta = document.createElement("p");
  meta.className = "post-meta";
  meta.textContent = `${post.author} · ${formatDate(post.createdAt)}`;
  header.append(title, meta);

  const content = document.createElement("p");
  content.className = "post-content";
  content.textContent = post.content;
  const comments = document.createElement("div");
  comments.className = "comments";
  post.comments.forEach((comment) =>
    comments.appendChild(createComment(comment)),
  );

  const commentForm = document.createElement("form");
  commentForm.className = "comment-form";
  const commentInput = document.createElement("input");
  commentInput.type = "text";
  commentInput.maxLength = 1000;
  commentInput.placeholder = "댓글을 입력해주세요";
  commentInput.required = true;
  const commentButton = document.createElement("button");
  commentButton.type = "submit";
  commentButton.textContent = "댓글 달기";
  commentForm.append(commentInput, commentButton);
  commentForm.addEventListener("submit", (event) =>
    addComment(event, post.id, commentInput, comments),
  );
  article.append(header, content, comments, commentForm);
  return article;
}

async function loadPosts() {
  try {
    const response = await fetch(`${apiBase}/api/qna/posts`);
    const posts = await readApiResponse(response);
    if (!response.ok) throw new Error(posts.error);
    postList.replaceChildren();
    if (!posts.length) {
      const empty = document.createElement("p");
      empty.className = "empty-posts";
      empty.textContent = "아직 작성된 질문이 없습니다.";
      postList.appendChild(empty);
      return;
    }
    posts.forEach((post) => postList.appendChild(createPost(post)));
  } catch (error) {
    qnaStatus.textContent =
      error instanceof TypeError
        ? "Node 서버가 실행 중인지 확인해주세요."
        : error.message;
  }
}

async function addComment(event, postId, input, comments) {
  event.preventDefault();
  const content = input.value.trim();
  if (!content) return;
  try {
    const response = await fetch(
      `${apiBase}/api/qna/posts/${postId}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, author: currentAuthor() }),
      },
    );
    const comment = await readApiResponse(response);
    if (!response.ok) throw new Error(comment.error);
    comments.appendChild(createComment(comment));
    input.value = "";
  } catch (error) {
    qnaStatus.textContent = error.message || "댓글을 저장하지 못했습니다.";
  }
}

newPostButton.addEventListener("click", () => {
  postForm.hidden = !postForm.hidden;
  if (!postForm.hidden) postTitle.focus();
});

cancelPostButton.addEventListener("click", () => {
  postForm.reset();
  postForm.hidden = true;
});

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  qnaStatus.textContent = "질문을 등록하는 중...";
  try {
    const response = await fetch(`${apiBase}/api/qna/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: postTitle.value,
        content: postContent.value,
        author: currentAuthor(),
      }),
    });
    const post = await readApiResponse(response);
    if (!response.ok) throw new Error(post.error);
    postForm.reset();
    postForm.hidden = true;
    qnaStatus.textContent = "질문이 등록되었습니다.";
    await loadPosts();
  } catch (error) {
    qnaStatus.textContent = error.message || "질문을 등록하지 못했습니다.";
  }
});

loadPosts();
