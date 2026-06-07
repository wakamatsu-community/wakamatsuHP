"""
Google カレンダー予定取得スクリプト
- 本番 (GitHub Actions): 環境変数 GOOGLE_SERVICE_ACCOUNT_KEY (JSON文字列) で認証
- ローカル開発 : .env の GOOGLE_SERVICE_ACCOUNT_PATH (JSONファイルパス) で認証
取得結果を docs/events.json に保存 → GitHub Pages で参照可能
"""

import json
import os
import sys
from datetime import datetime, timezone

# ローカル開発時のみ .env を読み込む（本番環境では何もしない）
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv が未インストールの場合はスキップ

from google.oauth2 import service_account
from googleapiclient.discovery import build

# ---------------------------------------------------------------
# 設定
# ---------------------------------------------------------------
SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "docs", "events.json")
# 取得する予定の件数上限
MAX_RESULTS = 50


def get_credentials() -> service_account.Credentials:
    """
    認証情報を取得する。
    優先順位:
      1. GOOGLE_SERVICE_ACCOUNT_KEY (JSON文字列) ← GitHub Actions
      2. GOOGLE_SERVICE_ACCOUNT_PATH (ファイルパス) ← ローカル .env
    """
    key_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_KEY")
    if key_json:
        # 本番: 環境変数に埋め込まれた JSON 文字列から認証
        try:
            info = json.loads(key_json)
        except json.JSONDecodeError as exc:
            print(f"[ERROR] GOOGLE_SERVICE_ACCOUNT_KEY の JSON パースに失敗しました: {exc}", file=sys.stderr)
            sys.exit(1)
        return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)

    key_path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_PATH")
    if key_path:
        # ローカル: .env に書かれたファイルパスから認証
        if not os.path.isfile(key_path):
            print(f"[ERROR] 指定されたサービスアカウントファイルが見つかりません: {key_path}", file=sys.stderr)
            sys.exit(1)
        return service_account.Credentials.from_service_account_file(key_path, scopes=SCOPES)

    print(
        "[ERROR] 認証情報が見つかりません。\n"
        "  本番環境 : 環境変数 GOOGLE_SERVICE_ACCOUNT_KEY を設定してください。\n"
        "  ローカル : .env に GOOGLE_SERVICE_ACCOUNT_PATH を設定してください。",
        file=sys.stderr,
    )
    sys.exit(1)


def fetch_events(service, calendar_id: str) -> list[dict]:
    """Google Calendar API から今後の予定を取得する。"""
    now = datetime.now(timezone.utc).isoformat()
    result = (
        service.events()
        .list(
            calendarId=calendar_id,
            timeMin=now,
            maxResults=MAX_RESULTS,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )
    return result.get("items", [])


def format_event(event: dict) -> dict:
    """API レスポンスから必要なフィールドだけ抽出して返す。"""
    start = event.get("start", {})
    end = event.get("end", {})
    return {
        "id": event.get("id", ""),
        "summary": event.get("summary", "（タイトルなし）"),
        "description": event.get("description", ""),
        "location": event.get("location", ""),
        "start": start.get("dateTime") or start.get("date", ""),
        "end": end.get("dateTime") or end.get("date", ""),
        "allDay": "date" in start and "dateTime" not in start,
        "htmlLink": event.get("htmlLink", ""),
    }


def save_events(events: list[dict]) -> None:
    """予定リストを JSON ファイルとして保存する。"""
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    payload = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "events": events,
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"[INFO] {len(events)} 件の予定を {OUTPUT_PATH} に保存しました。")


def main() -> None:
    calendar_id = os.environ.get("GOOGLE_CALENDAR_ID")
    if not calendar_id:
        print("[ERROR] 環境変数 GOOGLE_CALENDAR_ID が設定されていません。", file=sys.stderr)
        sys.exit(1)

    credentials = get_credentials()
    service = build("calendar", "v3", credentials=credentials)

    raw_events = fetch_events(service, calendar_id)
    formatted = [format_event(e) for e in raw_events]
    save_events(formatted)


if __name__ == "__main__":
    main()
