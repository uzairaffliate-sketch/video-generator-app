"""
drive_fetcher.py
Google Drive public folder se images download karta hai.
Usage: python drive_fetcher.py <folder_id> <output_dir>
"""

import os
import sys
import re
import json
import requests
from pathlib import Path


def extract_folder_id(url_or_id: str) -> str:
    """
    Google Drive folder URL se folder ID extract karo.
    Supported formats:
      - https://drive.google.com/drive/folders/FOLDER_ID
      - https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
      - Direct folder ID
    """
    patterns = [
        r"drive\.google\.com/drive/folders/([a-zA-Z0-9_-]+)",
        r"drive\.google\.com/open\?id=([a-zA-Z0-9_-]+)",
        r"id=([a-zA-Z0-9_-]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
    # Agar koi URL nahi, direct ID return karo
    return url_or_id.strip()


def get_files_from_folder(folder_id: str) -> list[dict]:
    """
    Google Drive public folder se file list fetch karo.
    Google Drive folder ko public karna zaroori hai.
    """
    # Google Drive folder ko HTML page se scrape karte hain (no API key needed)
    url = f"https://drive.google.com/drive/folders/{folder_id}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        # File IDs aur names extract karo HTML se
        # Pattern: data-id="FILE_ID" ... aria-label="FILENAME"
        file_pattern = r'"([a-zA-Z0-9_-]{28,})"[^}]*?"([^"]+\.(jpg|jpeg|png|webp|bmp))"'
        matches = re.findall(file_pattern, response.text, re.IGNORECASE)
        
        files = []
        seen_ids = set()
        
        for match in matches:
            file_id = match[0]
            filename = match[1]
            if file_id not in seen_ids and len(file_id) > 20:
                seen_ids.add(file_id)
                files.append({
                    "id": file_id,
                    "name": filename,
                    "download_url": f"https://drive.google.com/uc?export=download&id={file_id}"
                })
        
        # Fallback: Try alternative scraping method
        if not files:
            files = scrape_folder_alternative(response.text, folder_id)
        
        print(f"[drive_fetcher] Found {len(files)} images in folder")
        return files
        
    except requests.RequestException as e:
        print(f"[drive_fetcher] ERROR: {e}")
        return []


def scrape_folder_alternative(html: str, folder_id: str) -> list[dict]:
    """Alternative scraping method for different Drive layouts."""
    files = []
    
    # Try to find file entries in JSON-like data embedded in page
    # Google Drive embeds file data as JSON arrays
    pattern = r'\["([a-zA-Z0-9_-]{25,})",[^,]+,"([^"]+\.(jpg|jpeg|png|webp|bmp))"'
    matches = re.findall(pattern, html, re.IGNORECASE)
    
    seen = set()
    for match in matches:
        file_id, filename = match[0], match[1]
        if file_id not in seen:
            seen.add(file_id)
            files.append({
                "id": file_id,
                "name": filename,
                "download_url": f"https://drive.google.com/uc?export=download&id={file_id}"
            })
    
    return files


def download_image(file_info: dict, output_dir: str) -> str | None:
    """Single image download karo Google Drive se."""
    output_path = os.path.join(output_dir, file_info["name"])
    
    # Pehle check karo agar already downloaded hai
    if os.path.exists(output_path):
        print(f"[drive_fetcher] Already exists: {file_info['name']}")
        return output_path
    
    try:
        # Google Drive large file download handling
        session = requests.Session()
        url = file_info["download_url"]
        
        response = session.get(url, stream=True, timeout=60)
        
        # Check for virus scan warning (large files)
        if "confirm=" in response.url or b"virus scan warning" in response.content[:500]:
            # Get confirmation token
            token_match = re.search(r'confirm=([0-9A-Za-z_-]+)', response.text)
            if token_match:
                confirm_token = token_match.group(1)
                url = f"{url}&confirm={confirm_token}"
                response = session.get(url, stream=True, timeout=60)
        
        response.raise_for_status()
        
        with open(output_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=32768):
                f.write(chunk)
        
        print(f"[drive_fetcher] Downloaded: {file_info['name']}")
        return output_path
        
    except Exception as e:
        print(f"[drive_fetcher] Failed to download {file_info['name']}: {e}")
        return None


def fetch_all_images(folder_id: str, output_dir: str) -> list[dict]:
    """
    Folder ki saari images download karo.
    Returns: List of {name, path} dicts
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    print(f"[drive_fetcher] Fetching from folder: {folder_id}")
    files = get_files_from_folder(folder_id)
    
    if not files:
        print("[drive_fetcher] WARNING: No images found. Check if folder is public.")
        return []
    
    downloaded = []
    for file_info in files:
        path = download_image(file_info, output_dir)
        if path:
            downloaded.append({
                "name": file_info["name"],
                "path": path,
                "id": file_info["id"]
            })
    
    print(f"[drive_fetcher] Successfully downloaded: {len(downloaded)}/{len(files)} images")
    return downloaded


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python drive_fetcher.py <folder_id_or_url> <output_dir>")
        sys.exit(1)
    
    folder_input = sys.argv[1]
    output_directory = sys.argv[2]
    
    folder_id = extract_folder_id(folder_input)
    print(f"[drive_fetcher] Extracted folder ID: {folder_id}")
    
    results = fetch_all_images(folder_id, output_directory)
    
    # Save results to JSON for other scripts to use
    results_file = os.path.join(output_directory, "downloaded_files.json")
    with open(results_file, "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"[drive_fetcher] Results saved to: {results_file}")
    print(f"[drive_fetcher] DONE. {len(results)} images ready.")
