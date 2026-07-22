const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const animeList = document.querySelector("#anime-list");
const resultStatus = document.querySelector("#result-status");
const apiBase = window.location.port === "3000" ? "" : "http://localhost:3000";

function renderAnime(anime) {
  const rating =
    anime.avg_rating == null ? "평점 없음" : `★ ${anime.avg_rating.toFixed(1)}`;
  const genres = anime.genres?.slice(0, 3).join(" · ") || "장르 정보 없음";

  return `
    <a class="anime-card" href="${anime.url}" target="_blank" rel="noreferrer">
      <div class="poster-wrap">
        <img src="${anime.image}" alt="${anime.name} 포스터" loading="lazy" />
        <span class="rating">${rating}</span>
      </div>
      <div class="anime-card-body">
        <h3>${anime.name}</h3>
        <p class="genres">${genres}</p>
      </div>
    </a>
  `;
}

async function loadAnime(query = "") {
  animeList.innerHTML =
    '<p class="loading">Laftel에서 작품을 불러오는 중...</p>';
  resultStatus.textContent = query
    ? `'${query}' 검색 결과`
    : "전체 작품 · 평점순";

  try {
    const response = await fetch(
      `${apiBase}/api/anime?query=${encodeURIComponent(query)}`,
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "작품을 불러오지 못했습니다.");

    resultStatus.textContent = query
      ? `'${query}' 검색 결과 ${data.length}개`
      : `전체 작품 ${data.length}개 · 평점순`;
    animeList.innerHTML = data.length
      ? data.map(renderAnime).join("")
      : '<p class="empty">검색 결과가 없습니다.</p>';
  } catch (error) {
    resultStatus.textContent = "불러오기 실패";
    const message =
      error instanceof TypeError
        ? "Node 서버가 실행 중인지 확인하세요: http://localhost:3000"
        : error.message;
    animeList.innerHTML = `<p class="empty">${message}</p>`;
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadAnime(searchInput.value.trim());
});

loadAnime();
