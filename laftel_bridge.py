import asyncio
import json
import sys

asyncio.set_event_loop(asyncio.new_event_loop())
sys.stdout.reconfigure(encoding="utf-8")

import laftel


def serialize_result(result, info):
    return {
        "id": result.id,
        "name": result.name,
        "url": result.url,
        "image": result.image,
        "genres": result.genres,
        "content": info.content,
        "avg_rating": info.avg_rating,
    }


async def load_anime(query):
    # The wrapper returns no results for an empty keyword, so combine broad searches
    # to build the initial catalog while keeping typed searches exact.
    search_queries = [query] if query else ["a", "-", "0", "?"]
    found = {}

    for search_query in search_queries:
        for result in await laftel.searchAnime(search_query):
            found[result.id] = result

    async def add_details(result):
        try:
            info = await laftel.getAnimeInfo(result.id)
            return serialize_result(result, info)
        except Exception:
            return None

    detailed_results = await asyncio.gather(*(add_details(result) for result in found.values()))
    return sorted(
        (result for result in detailed_results if result is not None),
        key=lambda result: result["avg_rating"] or 0,
        reverse=True,
    )


try:
    query = sys.argv[1] if len(sys.argv) > 1 else ""
    print(json.dumps(asyncio.run(load_anime(query)), ensure_ascii=False))
except Exception as error:
    print(str(error), file=sys.stderr)
    sys.exit(1)