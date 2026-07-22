const signupForm = document.querySelector("#signup-form");
const signupStatus = document.querySelector("#signup-status");
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

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(signupForm);
  const password = formData.get("password");
  const confirmPassword = formData.get("confirm_password");

  if (password !== confirmPassword) {
    signupStatus.textContent = "비밀번호가 일치하지 않습니다.";
    return;
  }

  signupStatus.textContent = "회원가입 처리 중...";
  try {
    const response = await fetch(`${authApiBase}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: formData.get("username"), password }),
    });
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error);
    alert(data.message);
    window.location.href = "login.html";
  } catch (error) {
    signupStatus.textContent =
      error instanceof TypeError
        ? "Node 서버가 실행 중인지 확인해주세요."
        : error.message;
  }
});
