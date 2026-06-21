#!/usr/bin/env python3
"""
0x0.st pe video upload karne ka simple script.
Video upload ho jayegi aur download link mil jayega.
"""

import os
import sys
import requests
import json
from pathlib import Path

def upload_to_0x0(file_path, job_id):
    """0x0.st pe video upload karo"""
    
    file_name = f"video_{job_id}.mp4"
    
    print(f"📤 Uploading: {file_name}")
    print(f"📂 File: {file_path}")
    
    # Check karo file exist karti hai
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return None
    
    try:
        # 0x0.st pe upload karo
        with open(file_path, 'rb') as f:
            files = {'file': (file_name, f, 'video/mp4')}
            response = requests.post(
                'https://0x0.st',
                files=files,
                timeout=300  # 5 minutes timeout
            )
        
        # 0x0.st response mein seedha link return hota hai (plain text)
        if response.status_code == 200:
            link = response.text.strip()
            
            # Check karo ke link valid hai
            if link.startswith('http'):
                print(f"✅ Upload Successful!")
                print(f"🔗 Download Link: {link}")
                
                # Link save karo
                with open('/tmp/work/output/download_link.txt', 'w') as f:
                    f.write(link)
                
                # JSON format mein bhi save karo (for metadata)
                with open('/tmp/work/output/upload_info.json', 'w') as f:
                    json.dump({
                        "success": True,
                        "link": link,
                        "job_id": job_id
                    }, f, indent=2)
                
                return link
            else:
                print(f"❌ Upload failed: Unexpected response: {link}")
                return None
        else:
            print(f"❌ Upload failed with status: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Upload error: {str(e)}")
        return None

def main():
    if len(sys.argv) < 4:
        print("Usage: upload_to_drive.py <file_path> <folder_id> <job_id>")
        print("Note: folder_id is not used for 0x0.st, but kept for compatibility")
        sys.exit(1)
    
    file_path = sys.argv[1]
    # folder_id = sys.argv[2]  # Not used
    job_id = sys.argv[3]
    
    upload_to_0x0(file_path, job_id)

if __name__ == "__main__":
    main()
