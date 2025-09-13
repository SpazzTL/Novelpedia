import requests
from bs4 import BeautifulSoup
import json

headers = {
   "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139.0.0.0 Safari/537.36",
}


session = requests.Session()

session.headers.update(headers)

payload = {
    'redirectrurl': "https://novelpia.com/proc/login",
    'email': '',
    'wd': '',
    'idsave': 'on'
}
response = session.post("https://novelpia.com/proc/login", data=payload)
cookie = session.cookies["LOGINKEY"]




search_values = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

novel_metadata_list = []
seen = set()
search_values = ['판타지', '현대', '패러디', '하렘', '라이트노벨', '일상', '로맨스', '현대판타지', 'TS', '먼치킨', '중세', '전생', '집착', '아카데미', '고수위', '드라마', 'SF', '순애', '빙의', '피폐', '성장', '착각', '무협', '블루아카이브', '후회', '코미디', '이세계', '기타', '백합', '회귀', '약피폐', '아포칼립스', '얀데레', '게임', '환생', '남성향', '헌터', '조교', '복수', '인터넷방송', '남녀역전', '대체역사', '모험', '원신', '상태창', '공포', '생존', '전쟁', '가면라이더', '액션']


for i, search_value in enumerate(search_values):
    print(f"Progress: {i + 1}/{len(search_values)}")
    print("Search Value:", search_value)
    print(f"Scraped: {len(novel_metadata_list)}")

    url = f"https://novelpia.com/proc/novel?cmd=novel_search&page=1&rows=99999&search_type=all&search_val={search_value}&novel_type=&start_count_book=&end_count_book=&novel_age=&start_days=&sort_col=last_viewdate&novel_genre=&block_out=0&block_stop=0&is_contest=0&is_complete=&is_challenge=0&list_display=list&_=1757687695300"

    response = session.get(url)
    response.encoding = 'utf-8'

    print("Status Code:", response.status_code)
    print("Server:", response.headers.get("Server", "Unknown"))
    try:
        print("First 500 chars:\n", response.text[:500])


        data = response.json()

        resp_list = data["list"]
        print(f"{search_value} response length: {len(resp_list)}")

        for item in resp_list:
            novel_id = item['novel_no']
            novel_title = item['novel_name']
            synopsis = item['novel_story']
            author = item['writer_nick']
            cover_url = "https://novelpia.com" + item['novel_img_all']
            tags = item['novel_genre_arr']
            view_count = item['count_view']
            chapter_count = item['count_book']
            like_count = item['count_good']
            novel_status = item['novel_status']
            is_complete =item['is_complete']
            
            
            
            metadata = {"id": novel_id, "title": novel_title, "synopsis": synopsis, "author": author, "cover_url": cover_url, "tags": tags, "view_count": view_count, "like_count": like_count, "chapter_count": chapter_count, "novel_status": novel_status,"is_complete": is_complete}

            if novel_id not in seen:
                seen.add(novel_id)
                novel_metadata_list.append(metadata)
    except Exception as e:
        print(f"{e} in {search_value}")


with open(f"novelpia_metadata.jsonl", "w", encoding="utf-8") as f:
    for metadata in novel_metadata_list:
        f.write(json.dumps(metadata, ensure_ascii=False) + '\n')

novel_id_list = list(seen)
with open(f"novelpia_9999_id_list.py", "w", encoding="utf-8") as f:
    f.write(f"novel_ids = {novel_id_list}")