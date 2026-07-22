const loginForm = document.querySelector("#login-form");
const loginStatus = document.querySelector("#login-status");
const authApiBase = "http://localhost:3000";

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

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  loginStatus.textContent = "로그인 처리 중...";

  try {
    const response = await fetch(`${authApiBase}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password"),
      }),
    });
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error);
    localStorage.setItem("jumpup_username", data.username);
    window.location.href = "home.html";
  } catch (error) {
    loginStatus.textContent =
      error instanceof TypeError
        ? "Node 서버가 실행 중인지 확인해주세요."
        : error.message;
  }
});
