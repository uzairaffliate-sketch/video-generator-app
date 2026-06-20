"""
video_generator.py
Images + Audio → Final MP4 with Ken Burns effect.
Gemini-recommended settings for HP EliteBook 840 G6.

Usage: python video_generator.py <matched_json> <audio_mp3> <output_mp4>
"""

import os
import sys
import json
import traceback
from pathlib import Path


# ─── Ken Burns Effect Functions ───────────────────────────────────────────────

def make_ken_burns_clip(img_path: str, duration: float, effect: str = "zoom_in"):
    """
    Single image ke liye Ken Burns effect clip banao.
    
    Effects:
    - zoom_in:    Center se bahar zoom
    - zoom_out:   Bahar se center zoom
    - pan_right:  Left se right pan
    - pan_left:   Right se left pan
    - pan_up:     Neeche se upar pan
    """
    from moviepy.editor import ImageClip
    import numpy as np
    
    # Image load karo
    clip = ImageClip(img_path)
    
    # Target resolution: 1920x1080
    TARGET_W, TARGET_H = 1920, 1080
    
    # Image ko target size pe fit karo (crop center)
    img_w, img_h = clip.size
    scale = max(TARGET_W / img_w, TARGET_H / img_h) * 1.15  # 15% extra for pan room
    
    new_w = int(img_w * scale)
    new_h = int(img_h * scale)
    
    clip = clip.resize((new_w, new_h))
    
    # Ken Burns effect apply karo
    if effect == "zoom_in":
        # Smooth zoom in: 1.0x → 1.12x
        def zoom_in_effect(get_frame, t):
            progress = t / duration
            zoom = 1.0 + 0.12 * progress
            frame = get_frame(t)
            h, w = frame.shape[:2]
            new_h_z = int(h / zoom)
            new_w_z = int(w / zoom)
            y1 = (h - new_h_z) // 2
            x1 = (w - new_w_z) // 2
            cropped = frame[y1:y1+new_h_z, x1:x1+new_w_z]
            # Resize back
            from PIL import Image
            img_pil = Image.fromarray(cropped)
            img_pil = img_pil.resize((TARGET_W, TARGET_H), Image.LANCZOS)
            return np.array(img_pil)
        
        result = clip.fl(zoom_in_effect)
        
    elif effect == "zoom_out":
        # Smooth zoom out: 1.12x → 1.0x
        def zoom_out_effect(get_frame, t):
            progress = t / duration
            zoom = 1.12 - 0.12 * progress
            frame = get_frame(t)
            h, w = frame.shape[:2]
            new_h_z = int(h / zoom)
            new_w_z = int(w / zoom)
            y1 = (h - new_h_z) // 2
            x1 = (w - new_w_z) // 2
            cropped = frame[y1:y1+new_h_z, x1:x1+new_w_z]
            from PIL import Image
            img_pil = Image.fromarray(cropped)
            img_pil = img_pil.resize((TARGET_W, TARGET_H), Image.LANCZOS)
            return np.array(img_pil)
        
        result = clip.fl(zoom_out_effect)
        
    elif effect == "pan_right":
        # Left se right pan
        def pan_right_effect(get_frame, t):
            progress = t / duration
            frame = get_frame(t)
            h, w = frame.shape[:2]
            max_offset = w - TARGET_W
            if max_offset < 0:
                max_offset = 0
            x_offset = int(max_offset * progress * 0.3)
            y_offset = (h - TARGET_H) // 2
            y_offset = max(0, y_offset)
            x_offset = max(0, min(x_offset, w - TARGET_W)) if w > TARGET_W else 0
            cropped = frame[y_offset:y_offset+TARGET_H, x_offset:x_offset+TARGET_W]
            if cropped.shape[0] != TARGET_H or cropped.shape[1] != TARGET_W:
                from PIL import Image
                img_pil = Image.fromarray(frame)
                img_pil = img_pil.resize((TARGET_W, TARGET_H), Image.LANCZOS)
                return np.array(img_pil)
            return cropped
        
        result = clip.fl(pan_right_effect)
        
    elif effect == "pan_left":
        def pan_left_effect(get_frame, t):
            progress = t / duration
            frame = get_frame(t)
            h, w = frame.shape[:2]
            max_offset = max(0, w - TARGET_W)
            x_offset = int(max_offset * (1 - progress * 0.3))
            y_offset = max(0, (h - TARGET_H) // 2)
            x_offset = max(0, min(x_offset, max(0, w - TARGET_W)))
            if w >= TARGET_W and h >= TARGET_H:
                cropped = frame[y_offset:y_offset+TARGET_H, x_offset:x_offset+TARGET_W]
            else:
                from PIL import Image
                img_pil = Image.fromarray(frame)
                img_pil = img_pil.resize((TARGET_W, TARGET_H), Image.LANCZOS)
                return np.array(img_pil)
            if cropped.shape[0] == TARGET_H and cropped.shape[1] == TARGET_W:
                return cropped
            from PIL import Image
            img_pil = Image.fromarray(frame)
            img_pil = img_pil.resize((TARGET_W, TARGET_H), Image.LANCZOS)
            return np.array(img_pil)
        
        result = clip.fl(pan_left_effect)
        
    else:
        # Default: simple crop to target size
        result = clip.crop(
            x_center=new_w // 2,
            y_center=new_h // 2,
            width=TARGET_W,
            height=TARGET_H
        )
    
    return result.set_duration(duration)


# ─── Effect Rotation ──────────────────────────────────────────────────────────

EFFECTS_CYCLE = ["zoom_in", "zoom_out", "pan_right", "pan_left", "zoom_in", "pan_right"]


def get_effect_for_index(index: int) -> str:
    """Variety ke liye effects rotate karo."""
    return EFFECTS_CYCLE[index % len(EFFECTS_CYCLE)]


# ─── Main Video Generation ────────────────────────────────────────────────────

def generate_video(
    matched_data: dict,
    audio_path: str,
    output_path: str,
    fps: int = 25
) -> bool:
    """
    Matched images + audio se final video banao.
    
    Args:
        matched_data: image_matcher.py ka output JSON
        audio_path: Voiceover MP3 path
        output_path: Output MP4 path
        fps: Frames per second (25 recommended)
    
    Returns:
        True if success
    """
    try:
        from moviepy.editor import (
            ImageClip, AudioFileClip, concatenate_videoclips, CompositeVideoClip
        )
        
        segments = matched_data["segments"]
        
        if not segments:
            print("[video_generator] ERROR: No segments found!")
            return False
        
        print(f"[video_generator] Processing {len(segments)} segments...")
        print(f"[video_generator] Audio: {audio_path}")
        print(f"[video_generator] Output: {output_path}")
        
        # Output dir banao
        Path(os.path.dirname(output_path)).mkdir(parents=True, exist_ok=True)
        
        # Audio load karo
        if not os.path.exists(audio_path):
            print(f"[video_generator] ERROR: Audio file not found: {audio_path}")
            return False
        
        audio_clip = AudioFileClip(audio_path)
        total_audio_duration = audio_clip.duration
        print(f"[video_generator] Audio duration: {total_audio_duration:.1f}s")
        
        # Har segment ki actual duration calculate karo
        # Total audio duration ko segments mein proportionally divide karo
        total_estimated = sum(s["estimated_duration"] for s in segments)
        
        # Image clips banao
        video_clips = []
        current_time = 0.0
        
        for i, segment in enumerate(segments):
            img_path = segment.get("matched_image_path", "")
            
            # Image path validate karo
            if not img_path or not os.path.exists(img_path):
                print(f"[video_generator] WARNING: Image not found for segment {i+1}: {img_path}")
                # Skip karo ya placeholder use karo
                continue
            
            # Proportional duration calculate karo
            if total_estimated > 0:
                proportion = segment["estimated_duration"] / total_estimated
                duration = proportion * total_audio_duration
            else:
                duration = segment["estimated_duration"]
            
            # Minimum 3 seconds, maximum 15 seconds per segment
            duration = max(3.0, min(duration, 15.0))
            
            print(f"[video_generator] Segment {i+1}/{len(segments)}: "
                  f"{os.path.basename(img_path)} ({duration:.1f}s) "
                  f"- Effect: {get_effect_for_index(i)}")
            
            try:
                # Ken Burns clip banao
                effect = get_effect_for_index(i)
                clip = make_ken_burns_clip(img_path, duration, effect)
                video_clips.append(clip)
                current_time += duration
                
            except Exception as e:
                print(f"[video_generator] WARNING: Failed clip {i+1}: {e}")
                # Simple fallback clip
                try:
                    simple_clip = ImageClip(img_path).set_duration(duration)
                    simple_clip = simple_clip.resize((1920, 1080))
                    video_clips.append(simple_clip)
                except Exception as e2:
                    print(f"[video_generator] ERROR: Fallback also failed: {e2}")
        
        if not video_clips:
            print("[video_generator] ERROR: No valid clips created!")
            audio_clip.close()
            return False
        
        print(f"\n[video_generator] Concatenating {len(video_clips)} clips...")
        
        # Saare clips concatenate karo
        final_video = concatenate_videoclips(video_clips, method="compose")
        
        # Audio sync karo with video duration
        video_duration = final_video.duration
        
        if total_audio_duration > video_duration:
            # Video chhota hai audio se - last image extend karo
            audio_clip = audio_clip.subclip(0, video_duration)
        elif total_audio_duration < video_duration:
            # Audio chhota hai - video trim karo
            final_video = final_video.subclip(0, total_audio_duration)
        
        # Audio attach karo
        final_video = final_video.set_audio(audio_clip)
        
        print(f"[video_generator] Final video duration: {final_video.duration:.1f}s")
        print(f"[video_generator] Rendering video (this may take a while)...")
        print(f"[video_generator] Settings: libx264, 4000k, fps=25, preset=faster, tune=stillimage")
        
        # ─── GEMINI RECOMMENDED SETTINGS ─────────────────────────────────────
        final_video.write_videofile(
            output_path,
            fps=fps,                          # 25 FPS - quality same, load 16% kam
            codec="libx264",                  # H.264 - best compatibility
            bitrate="4000k",                  # Crystal clear 1080p, small file
            threads=4,                        # EliteBook ke 4 cores
            preset="faster",                  # Speed aur compression balance
            ffmpeg_params=[
                "-tune", "stillimage",        # SECRET: 50% size reduction for image-based videos
                "-movflags", "+faststart",    # Web streaming ke liye optimize
                "-profile:v", "high",         # High profile for better compression
                "-level", "4.1"               # H.264 level
            ],
            logger=None,                      # Verbose output disable
            write_logfile=False
        )
        # ─────────────────────────────────────────────────────────────────────
        
        # RAM cleanup (laptop hang hone se bachao)
        final_video.close()
        audio_clip.close()
        for clip in video_clips:
            try:
                clip.close()
            except Exception:
                pass
        
        # Output file check karo
        if os.path.exists(output_path):
            file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
            print(f"\n[video_generator] ✅ VIDEO CREATED SUCCESSFULLY!")
            print(f"[video_generator] Output: {output_path}")
            print(f"[video_generator] Size: {file_size_mb:.1f} MB")
            return True
        else:
            print("[video_generator] ERROR: Output file not created!")
            return False
        
    except Exception as e:
        print(f"[video_generator] FATAL ERROR: {e}")
        traceback.print_exc()
        return False


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python video_generator.py <matched_json> <audio_mp3> <output_mp4>")
        sys.exit(1)
    
    matched_json_file = sys.argv[1]
    audio_mp3 = sys.argv[2]
    output_mp4 = sys.argv[3]
    
    # Matched data load karo
    with open(matched_json_file, "r") as f:
        matched_data = json.load(f)
    
    print(f"[video_generator] Loaded {matched_data['total_segments']} segments")
    print(f"[video_generator] Estimated duration: {matched_data['total_duration_seconds']:.1f}s")
    
    success = generate_video(matched_data, audio_mp3, output_mp4)
    
    if success:
        print("[video_generator] DONE.")
        sys.exit(0)
    else:
        print("[video_generator] FAILED.")
        sys.exit(1)
