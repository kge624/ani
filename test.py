import asyncio

# Python 3.14 호환을 위해 import laftel 전에 이벤트 루프를 미리 생성/설정합니다.
asyncio.set_event_loop(asyncio.new_event_loop())

import laftel

# '전생슬' 검색 예시
try:
    results = laftel.sync.searchAnime("전생슬")
    
    print("=== 검색 결과 ===")
    for anime in results:
        print(f"ID: {anime.id} | 제목: {anime.name}")

    if results:
        info = laftel.sync.getAnimeInfo(results[0].id)
        print("\n=== 첫 번째 애니 상세 정보 ===")
        print(f"제목: {info.name}")
        print(f"줄거리: {info.content}")

except Exception as e:
    print(f"오류 발생: {e}")