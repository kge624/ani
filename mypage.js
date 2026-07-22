const profileAvatar = document.querySelector("#profile-avatar");
const profileName = document.querySelector("#profile-name");
const profileCreated = document.querySelector("#profile-created");
const logoutButton = document.querySelector("#logout-button");
const mypageStatus = document.querySelector("#mypage-status");
const myPosts = document.querySelector("#my-posts");
const myComments = document.querySelector("#my-comments");
const postCount = document.querySelector("#post-count");
const commentCount = document.querySelector("#comment-count");
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
const username = localStorage.getItem("jumpup_username");

function formatDate(value) {
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function showEmpty(container, message) {
  container.textContent = message;
  container.className = "activity-list empty-activity";
}

function renderActivity(container, items, type) {
  container.replaceChildren();
  if (!items.length) {
    showEmpty(
      container,
      type === "post" ? "작성한 질문이 없습니다." : "작성한 댓글이 없습니다.",
    );
    return;
  }
  items.forEach((item) => {
    const element = document.createElement("a");
    element.className = "activity-item";
    element.href = `qna.html#${item.type === "post" ? item.id : item.postId}`;
    const title = document.createElement("strong");
    title.textContent =
      item.type === "post" ? item.title : `댓글 · ${item.postTitle}`;
    const content = document.createElement("p");
    content.textContent = item.type === "post" ? item.content : item.content;
    const date = document.createElement("small");
    date.textContent = formatDate(item.createdAt);
    element.append(title, content, date);
    container.appendChild(element);
  });
}

async function loadMypage() {
  if (!username) {
    logoutButton.textContent = "로그인하기";
    logoutButton.addEventListener("click", () => {
      window.location.href = "login.html";
    });
    showEmpty(myPosts, "로그인 후 이용해주세요.");
    showEmpty(myComments, "로그인 후 이용해주세요.");
    return;
  }

  try {
    const response = await fetch(
      `${apiBase}/api/mypage?username=${encodeURIComponent(username)}`,
    );
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error);
    profileName.textContent = data.username;
    profileAvatar.textContent = data.username.charAt(0).toUpperCase();
    profileCreated.textContent = `${formatDate(data.createdAt)} 가입`;
    postCount.textContent = data.posts.length;
    commentCount.textContent = data.comments.length;
    renderActivity(
      myPosts,
      data.posts.map((item) => ({ ...item, type: "post" })),
      "post",
    );
    renderActivity(
      myComments,
      data.comments.map((item) => ({ ...item, type: "comment" })),
      "comment",
    );
  } catch (error) {
    mypageStatus.textContent =
      error instanceof TypeError
        ? "Node 서버가 실행 중인지 확인해주세요."
        : error.message;
  }
}

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("jumpup_username");
  window.location.href = "login.html";
});

loadMypage();
