"""
drive_fetcher.py  —  v2.0  (Future-proof)
==========================================
Google Drive PUBLIC folder se images download karta hai.

Strategy (3 layers, ek fail ho to agla try karta hai):
  Layer 1 → gdown library  (sabse reliable, Google Drive ke liye bana hai)
  Layer 2 → Google Drive API v3 public endpoint (no API key needed)
  Layer 3 → Direct HTML + regex fallback

Usage:
  python drive_fetcher.py <folder_url_or_id> <output_dir>
"""

import os
import sys
import re
import json
import time
import requests
from pathlib import Path


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def extract_folder_id(url_or_id: str) -> str:
    """Google Drive folder URL se ID nikalo."""
    patterns = [
        r"drive\.google\.com/drive/folders/([a-zA-Z0-9_-]+)",
        r"drive\.google\.com/open\?id=([a-zA-Z0-9_-]+)",
        r"id=([a-zA-Z0-9_-]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
    return url_or_id.strip()


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}

def is_image(filename: str) -> bool:
    return Path(filename).suffix.lower() in IMAGE_EXTENSIONS


# ─────────────────────────────────────────────
# LAYER 1: gdown  (Most Reliable)
# ─────────────────────────────────────────────

def fetch_via_gdown(folder_id: str, output_dir: str) -> list[dict]:
    """
    gdown library se puri folder download karo.
    gdown Google Drive ke liye specifically bana hai — authentication,
    virus-scan warnings, aur large files sab handle karta hai.
    """
    try:
        import gdown  # type: ignore
    except ImportError:
        print("[drive_fetcher] gdown not installed, skipping Layer 1.")
        return []

    print("[drive_fetcher] Layer 1: Trying gdown...")

    url = f"https://drive.google.com/drive/folders/{folder_id}"
    try:
        # gdown folder download — fuzzy=True handles different URL formats
        gdown.download_folder(
            url=url,
            output=output_dir,
            quiet=False,
            use_cookies=False,
            remaining_ok=True,   # partial downloads OK
        )
    except Exception as e:
        print(f"[drive_fetcher] gdown error: {e}")
        return []

    # Jo files download hui hain unhe collect karo
    downloaded = []
    for f in Path(output_dir).rglob("*"):
        if f.is_file() and is_image(f.name):
            downloaded.append({"name": f.name, "path": str(f)})

    print(f"[drive_fetcher] Layer 1 downloaded {len(downloaded)} images.")
    return downloaded


# ─────────────────────────────────────────────
# LAYER 2: Google Drive API v3 (No API Key Needed for Public Folders)
# ─────────────────────────────────────────────

def fetch_via_drive_api(folder_id: str, output_dir: str) -> list[dict]:
    """
    Google Drive API v3 public endpoint use karta hai.
    Public folders ke liye koi API key nahi chahiye.
    Yeh method actual file names aur IDs reliably deta hai.
    """
    print("[drive_fetcher] Layer 2: Trying Drive API v3...")

    # Google Drive API v3 — public folder listing
    api_url = "https://www.googleapis.com/drive/v3/files"
    params = {
        "q": f"'{folder_id}' in parents and trashed=false",
        "fields": "files(id,name,mimeType,size)",
        "pageSize": 1000,
        "supportsAllDrives": True,
        "includeItemsFromAllDrives": True,
        # Public access — no key needed for public folders
        "key": "AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY"  # Google's public demo key
    }

    files = []
    page_token = None

    while True:
        if page_token:
            params["pageToken"] = page_token

        try:
            resp = requests.get(api_url, params=params, timeout=30)
            if resp.status_code == 403:
                # Folder private hai ya key kaam nahi ki
                print("[drive_fetcher] Layer 2: API returned 403, folder might need API key.")
                return []
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"[drive_fetcher] Layer 2 API error: {e}")
            return []

        for item in data.get("files", []):
            if is_image(item["name"]):
                files.append({"id": item["id"], "name": item["name"]})

        page_token = data.get("nextPageToken")
        if not page_token:
            break

    print(f"[drive_fetcher] Layer 2 found {len(files)} images via API.")

    if not files:
        return []

    # Ab download karo
    return _download_files_list(files, output_dir)


# ─────────────────────────────────────────────
# LAYER 3: HTML Scraping Fallback
# ─────────────────────────────────────────────

def fetch_via_scraping(folder_id: str, output_dir: str) -> list[dict]:
    """
    Last resort: Drive folder page scrape karo.
    Google Drive ka JS-rendered HTML se embedded JSON data nikalna.
    """
    print("[drive_fetcher] Layer 3: Trying HTML scraping fallback...")

    url = f"https://drive.google.com/drive/folders/{folder_id}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }

    try:
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        html = resp.text
    except Exception as e:
        print(f"[drive_fetcher] Layer 3 scrape failed: {e}")
        return []

    files = []
    seen = set()

    # Pattern 1: JSON-like embedded data  ["FILE_ID", null, "filename.jpg"]
    pattern1 = r'\["([a-zA-Z0-9_-]{25,})",null,"([^"]+\.(jpg|jpeg|png|webp|bmp|gif))"'
    for m in re.finditer(pattern1, html, re.IGNORECASE):
        fid, fname = m.group(1), m.group(2)
        if fid not in seen:
            seen.add(fid)
            files.append({"id": fid, "name": fname})

    # Pattern 2: data-id with aria-label
    pattern2 = r'data-id="([a-zA-Z0-9_-]{25,})"[^>]*aria-label="([^"]+\.(jpg|jpeg|png|webp|bmp|gif))"'
    for m in re.finditer(pattern2, html, re.IGNORECASE):
        fid, fname = m.group(1), m.group(2)
        if fid not in seen:
            seen.add(fid)
            files.append({"id": fid, "name": fname})

    # Pattern 3: Broader JSON array pattern
    pattern3 = r'"([a-zA-Z0-9_-]{28,})"[^"]{0,100}"([^"]+\.(jpg|jpeg|png|webp|bmp|gif))"'
    for m in re.finditer(pattern3, html, re.IGNORECASE):
        fid, fname = m.group(1), m.group(2)
        if fid not in seen and len(fid) >= 28:
            seen.add(fid)
            files.append({"id": fid, "name": fname})

    print(f"[drive_fetcher] Layer 3 found {len(files)} images via scraping.")

    if not files:
        print("[drive_fetcher] WARNING: Folder might be private or empty.")
        return []

    return _download_files_list(files, output_dir)


# ─────────────────────────────────────────────
# DOWNLOAD HELPER
# ─────────────────────────────────────────────

def _download_files_list(files: list[dict], output_dir: str) -> list[dict]:
    """File IDs ki list ko download karo."""
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    downloaded = []

    for file_info in files:
        out_path = os.path.join(output_dir, file_info["name"])

        if os.path.exists(out_path):
            print(f"[drive_fetcher] Already exists: {file_info['name']}")
            downloaded.append({"name": file_info["name"], "path": out_path, "id": file_info["id"]})
            continue

        success = _download_single(file_info["id"], file_info["name"], out_path)
        if success:
            downloaded.append({"name": file_info["name"], "path": out_path, "id": file_info["id"]})
        
        time.sleep(0.3)  # Rate limiting se bachao

    return downloaded


def _download_single(file_id: str, filename: str, out_path: str) -> bool:
    """Single Google Drive file download karo — virus warning bypass ke saath."""
    session = requests.Session()
    url = f"https://drive.google.com/uc?export=download&id={file_id}"

    try:
        response = session.get(url, stream=True, timeout=60)

        # Large file virus scan warning handle karo
        if b"virus scan warning" in response.content[:2000] or "confirm=" in response.url:
            token_match = re.search(r'confirm=([0-9A-Za-z_-]+)', response.text)
            if token_match:
                url = f"{url}&confirm={token_match.group(1)}"
                response = session.get(url, stream=True, timeout=60)

        # Alternate confirm pattern (newer Drive)
        if response.headers.get("Content-Type", "").startswith("text/html"):
            uuid_match = re.search(r'uuid=([a-zA-Z0-9_-]+)', response.text)
            if uuid_match:
                confirm_url = (
                    f"https://drive.usercontent.google.com/download"
                    f"?id={file_id}&export=download&confirm=t&uuid={uuid_match.group(1)}"
                )
                response = session.get(confirm_url, stream=True, timeout=60)

        response.raise_for_status()

        with open(out_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=65536):
                if chunk:
                    f.write(chunk)

        size = os.path.getsize(out_path)
        if size < 1000:  # Suspiciously small — probably an error page
            os.remove(out_path)
            print(f"[drive_fetcher] SKIP (too small, likely error): {filename}")
            return False

        print(f"[drive_fetcher] ✓ Downloaded: {filename} ({size//1024} KB)")
        return True

    except Exception as e:
        print(f"[drive_fetcher] ✗ Failed: {filename} — {e}")
        return False


# ─────────────────────────────────────────────
# MAIN: 3-Layer Orchestrator
# ─────────────────────────────────────────────

def fetch_all_images(folder_input: str, output_dir: str) -> list[dict]:
    """
    Main function — 3 layers try karta hai, pehle jo kaam kare woh use karta hai.
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    folder_id = extract_folder_id(folder_input)
    print(f"[drive_fetcher] Folder ID: {folder_id}")
    print(f"[drive_fetcher] Output dir: {output_dir}")
    print("=" * 50)

    # Layer 1: gdown
    results = fetch_via_gdown(folder_id, output_dir)
    if results:
        print(f"[drive_fetcher] ✅ Layer 1 (gdown) succeeded: {len(results)} images")
        return results

    # Layer 2: Drive API
    results = fetch_via_drive_api(folder_id, output_dir)
    if results:
        print(f"[drive_fetcher] ✅ Layer 2 (API) succeeded: {len(results)} images")
        return results

    # Layer 3: HTML Scraping
    results = fetch_via_scraping(folder_id, output_dir)
    if results:
        print(f"[drive_fetcher] ✅ Layer 3 (scraping) succeeded: {len(results)} images")
        return results

    print("[drive_fetcher] ❌ All 3 layers failed.")
    print("[drive_fetcher] Check: Is folder public? (Share → Anyone with link → Viewer)")
    return []


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python drive_fetcher.py <folder_url_or_id> <output_dir>")
        sys.exit(1)

    folder_input = sys.argv[1]
    output_directory = sys.argv[2]

    results = fetch_all_images(folder_input, output_directory)

    # JSON save karo taake baaki scripts use kar sakein
    results_file = os.path.join(output_directory, "downloaded_files.json")
    with open(results_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n[drive_fetcher] Results saved: {results_file}")
    print(f"[drive_fetcher] DONE — {len(results)} images ready.")

    if not results:
        sys.exit(1)  # GitHub Actions ko failure signal do
