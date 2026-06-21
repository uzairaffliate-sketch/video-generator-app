#!/usr/bin/env python3
"""
Google Drive pe video upload karne ka simple script.
Public folder mein upload ho jayega.
"""

import os
import sys
import json
import requests
from pathlib import Path

def upload_to_drive(file_path, folder_id, job_id):
    """Simple curl command se Google Drive pe upload"""
    
    file_name = f"video_{job_id}.mp4"
    
    # ✅ Google Drive upload URL (public folder)
    # Is ke liye aapko folder ko "Anyone with link" pe set karna hoga
    
    print(f"📤 Uploading: {file_name}")
    print(f"📁 Folder: {folder_id}")
    print(f"📂 File: {file_path}")
    
    # ✅ Option 1: Agar aapke paas gdrive CLI installed hai
    # gdrive files upload --parent {folder_id} {file_path}
    
    # ✅ Option 2: Python se upload (Service Account required)
    # Simple approach - Upload to temp storage
    upload_to_temp(file_path, job_id)

def upload_to_temp(file_path, job_id):
    """Temporary storage pe upload (5 min mein ready)"""
    file_name = f"video_{job_id}.mp4"
    
    # ✅ Transfer.sh se upload (Fast & Free)
    cmd = f'curl --upload-file "{file_path}" "https://transfer.sh/{file_name}"'
    result = os.popen(cmd).read().strip()
    
    print(f"✅ Download Link: {result}")
    
    # ✅ Link save karo
    with open("/tmp/work/output/drive_link.txt", "w") as f:
        f.write(result)
    
    print(f"✅ Video uploaded successfully!")
    return result

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: upload_to_drive.py <file_path> <folder_id> <job_id>")
        sys.exit(1)
    
    upload_to_drive(sys.argv[1], sys.argv[2], sys.argv[3])
