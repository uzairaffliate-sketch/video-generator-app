"""
voice_generator.py
Script ko MP3 voiceover mein convert karta hai using gTTS (Google TTS - FREE).
No API key required.

Usage: python voice_generator.py <script_file> <output_mp3>
"""

import os
import sys
import json
import time
from pathlib import Path


def generate_voice(script_text: str, output_path: str, language: str = "en") -> bool:
    """
    Script se MP3 audio generate karo using gTTS.
    
    Args:
        script_text: Poori script
        output_path: Output MP3 file path
        language: Language code (default: English)
    
    Returns:
        True if success, False if failed
    """
    try:
        from gtts import gTTS
        
        print(f"[voice_generator] Generating voiceover...")
        print(f"[voice_generator] Script length: {len(script_text.split())} words")
        print(f"[voice_generator] Language: {language}")
        
        # Clean script - extra whitespace remove karo
        clean_script = " ".join(script_text.split())
        
        # gTTS object banao
        tts = gTTS(
            text=clean_script,
            lang=language,
            slow=False,  # Normal speed
            tld="com"    # Google TTS domain (com = default English)
        )
        
        # MP3 save karo
        output_dir = os.path.dirname(output_path)
        if output_dir:
            Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        tts.save(output_path)
        
        # File size check
        file_size = os.path.getsize(output_path)
        print(f"[voice_generator] Audio generated: {output_path}")
        print(f"[voice_generator] File size: {file_size / 1024:.1f} KB")
        
        return True
        
    except ImportError:
        print("[voice_generator] ERROR: gTTS not installed. Run: pip install gtts")
        return False
    except Exception as e:
        print(f"[voice_generator] ERROR: {e}")
        return False


def get_audio_duration(audio_path: str) -> float:
    """Audio file ki duration seconds mein return karo."""
    try:
        from moviepy.editor import AudioFileClip
        clip = AudioFileClip(audio_path)
        duration = clip.duration
        clip.close()
        return duration
    except Exception:
        # Fallback: estimate based on word count
        return 0.0


def generate_voice_chunks(
    segments: list[dict], 
    output_dir: str,
    language: str = "en"
) -> list[dict]:
    """
    Har segment ke liye alag audio chunk generate karo.
    Yeh precise timing ke liye useful hai.
    
    Args:
        segments: image_matcher.py ka output
        output_dir: Audio chunks save karne ki directory
        language: Language code
    
    Returns:
        Segments with audio_path added
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    try:
        from gtts import gTTS
        
        updated_segments = []
        
        for seg in segments:
            chunk_path = os.path.join(output_dir, f"chunk_{seg['index']:04d}.mp3")
            
            if os.path.exists(chunk_path):
                print(f"[voice_generator] Already exists: chunk_{seg['index']:04d}.mp3")
            else:
                try:
                    tts = gTTS(text=seg["text"], lang=language, slow=False)
                    tts.save(chunk_path)
                    print(f"[voice_generator] Generated chunk {seg['index']+1}/{len(segments)}")
                    time.sleep(0.3)  # Rate limiting se bachao
                except Exception as e:
                    print(f"[voice_generator] Failed chunk {seg['index']}: {e}")
                    chunk_path = None
            
            updated_segments.append({
                **seg,
                "audio_path": chunk_path
            })
        
        return updated_segments
        
    except ImportError:
        print("[voice_generator] ERROR: gTTS not installed")
        return segments


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python voice_generator.py <script_file_or_text> <output_mp3> [language]")
        print("Languages: en (English), ur (Urdu), hi (Hindi), ar (Arabic)")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_mp3 = sys.argv[2]
    lang = sys.argv[3] if len(sys.argv) > 3 else "en"
    
    # Script file read karo
    if os.path.exists(input_file):
        with open(input_file, "r", encoding="utf-8") as f:
            script = f.read()
    else:
        # Direct text as argument
        script = input_file
    
    success = generate_voice(script, output_mp3, language=lang)
    
    if success:
        duration = get_audio_duration(output_mp3)
        if duration > 0:
            print(f"[voice_generator] Audio duration: {duration:.1f} seconds ({duration/60:.1f} min)")
        print("[voice_generator] DONE.")
        sys.exit(0)
    else:
        print("[voice_generator] FAILED.")
        sys.exit(1)
