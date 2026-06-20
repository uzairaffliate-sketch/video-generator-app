"""
image_matcher.py
Script lines aur image filenames ko keyword similarity se match karta hai.
Har 5 seconds ka segment ek image use karta hai.

Algorithm:
1. Script ko sentences/chunks mein divide karo (har chunk ~5 sec audio = ~15 words)
2. Har chunk ke keywords extract karo
3. Image filename ke keywords se compare karo
4. Best match assign karo (with fallback to sequential)

Usage: python image_matcher.py <script_file> <images_json> <output_json>
"""

import os
import sys
import re
import json
import math
from pathlib import Path


# Common stop words - inhe ignore karo matching mein
STOP_WORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "on", "at", "by", "for", "with", "about",
    "against", "between", "into", "through", "during", "before", "after",
    "above", "below", "from", "up", "down", "out", "off", "over", "under",
    "again", "further", "then", "once", "and", "but", "or", "nor", "so",
    "yet", "both", "either", "neither", "not", "only", "own", "same",
    "than", "too", "very", "just", "because", "as", "until", "while",
    "this", "that", "these", "those", "i", "me", "my", "we", "our",
    "you", "your", "he", "she", "it", "its", "they", "them", "their",
    "what", "which", "who", "whom", "when", "where", "why", "how",
    "all", "each", "every", "any", "no", "more", "most", "other",
    "some", "such", "here", "there"
}

# Words per second estimate (average speaking pace)
WORDS_PER_SECOND = 2.5
# Seconds per image
SECONDS_PER_IMAGE = 5
# Words per image segment
WORDS_PER_SEGMENT = int(WORDS_PER_SECOND * SECONDS_PER_IMAGE)  # ~12-13 words


def clean_filename(filename: str) -> str:
    """Filename se extension aur special chars hata ke clean text banao."""
    name = Path(filename).stem  # Extension remove
    name = re.sub(r'[_\-\.]+', ' ', name)  # Special chars to spaces
    name = re.sub(r'\d+', '', name)  # Numbers remove
    return name.lower().strip()


def extract_keywords(text: str) -> set[str]:
    """Text se meaningful keywords extract karo."""
    # Lowercase aur clean
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    
    words = text.split()
    keywords = set()
    
    for word in words:
        word = word.strip()
        if len(word) > 2 and word not in STOP_WORDS:
            keywords.add(word)
            # Add word stem (simple suffix removal)
            if word.endswith('ing') and len(word) > 5:
                keywords.add(word[:-3])
            elif word.endswith('tion') and len(word) > 5:
                keywords.add(word[:-4])
            elif word.endswith('ed') and len(word) > 4:
                keywords.add(word[:-2])
            elif word.endswith('s') and len(word) > 3:
                keywords.add(word[:-1])
    
    return keywords


def calculate_similarity(text_keywords: set[str], filename_keywords: set[str]) -> float:
    """
    Jaccard similarity + bonus for exact matches.
    Score: 0.0 to 1.0
    """
    if not text_keywords or not filename_keywords:
        return 0.0
    
    intersection = text_keywords & filename_keywords
    union = text_keywords | filename_keywords
    
    if not union:
        return 0.0
    
    # Jaccard similarity
    jaccard = len(intersection) / len(union)
    
    # Bonus: filename keywords jo text mein exact hain
    exact_bonus = len(intersection) / max(len(filename_keywords), 1) * 0.3
    
    return min(jaccard + exact_bonus, 1.0)


def split_script_into_segments(script: str) -> list[dict]:
    """
    Script ko image segments mein divide karo.
    Har segment ~5 seconds audio ke barabar hai.
    Sentence boundaries respect karta hai.
    """
    # Sentences mein split karo
    sentences = re.split(r'(?<=[.!?])\s+', script.strip())
    sentences = [s.strip() for s in sentences if s.strip()]
    
    segments = []
    current_segment_words = []
    current_sentences = []
    segment_index = 0
    
    for sentence in sentences:
        words = sentence.split()
        
        # Agar current segment bahut bada ho jayega, new segment shuru karo
        if (current_segment_words and 
            len(current_segment_words) + len(words) > WORDS_PER_SEGMENT * 1.5):
            
            segments.append({
                "index": segment_index,
                "text": " ".join(current_sentences),
                "word_count": len(current_segment_words),
                "estimated_duration": len(current_segment_words) / WORDS_PER_SECOND
            })
            segment_index += 1
            current_segment_words = []
            current_sentences = []
        
        current_segment_words.extend(words)
        current_sentences.append(sentence)
        
        # Har WORDS_PER_SEGMENT words pe segment complete karo
        if len(current_segment_words) >= WORDS_PER_SEGMENT:
            segments.append({
                "index": segment_index,
                "text": " ".join(current_sentences),
                "word_count": len(current_segment_words),
                "estimated_duration": len(current_segment_words) / WORDS_PER_SECOND
            })
            segment_index += 1
            current_segment_words = []
            current_sentences = []
    
    # Remaining words
    if current_segment_words:
        segments.append({
            "index": segment_index,
            "text": " ".join(current_sentences),
            "word_count": len(current_segment_words),
            "estimated_duration": len(current_segment_words) / WORDS_PER_SECOND
        })
    
    return segments


def match_images_to_segments(
    segments: list[dict], 
    image_files: list[dict]
) -> list[dict]:
    """
    Har segment ko best matching image assign karo.
    
    Strategy:
    1. Pehle similarity scores calculate karo sab combinations ke liye
    2. Greedy assignment: highest score pehle assign karo
    3. Agar koi match nahi, sequential fallback use karo
    4. Agar images kam hain to repeat karo
    """
    if not image_files:
        return [{**seg, "matched_image": None, "match_score": 0.0} for seg in segments]
    
    # Har image ke keywords pre-compute karo
    image_keywords_map = {}
    for img in image_files:
        clean_name = clean_filename(img["name"])
        image_keywords_map[img["name"]] = extract_keywords(clean_name)
    
    # Similarity matrix banao
    scores_matrix = []
    for seg in segments:
        seg_keywords = extract_keywords(seg["text"])
        row = []
        for img in image_files:
            img_kw = image_keywords_map[img["name"]]
            score = calculate_similarity(seg_keywords, img_kw)
            row.append(score)
        scores_matrix.append(row)
    
    # Assignment: har segment ko best available image do
    # Allow reuse of images (agar segments > images)
    matched_results = []
    
    for seg_idx, seg in enumerate(segments):
        scores = scores_matrix[seg_idx]
        best_img_idx = scores.index(max(scores))
        best_score = scores[best_img_idx]
        
        # Agar score bahut low hai (0.05 se kam), sequential fallback
        if best_score < 0.05:
            fallback_idx = seg_idx % len(image_files)
            matched_img = image_files[fallback_idx]
            match_method = "sequential_fallback"
        else:
            matched_img = image_files[best_img_idx]
            match_method = "keyword_match"
        
        matched_results.append({
            **seg,
            "matched_image": matched_img["name"],
            "matched_image_path": matched_img.get("path", ""),
            "match_score": round(best_score, 3),
            "match_method": match_method
        })
    
    return matched_results


def match_script_to_images(
    script: str, 
    image_files: list[dict]
) -> dict:
    """
    Main function: Script + Images → Matched segments
    Returns complete matching data
    """
    print(f"[image_matcher] Script length: {len(script.split())} words")
    print(f"[image_matcher] Images available: {len(image_files)}")
    
    # Script ko segments mein divide karo
    segments = split_script_into_segments(script)
    print(f"[image_matcher] Created {len(segments)} segments (~5 sec each)")
    
    # Images ko segments se match karo
    matched = match_images_to_segments(segments, image_files)
    
    # Total video duration estimate
    total_duration = sum(m["estimated_duration"] for m in matched)
    
    # Summary print karo
    print("\n[image_matcher] Matching Results:")
    print("-" * 60)
    for m in matched:
        print(f"  Segment {m['index']+1}: '{m['text'][:50]}...'")
        print(f"    → {m['matched_image']} (score: {m['match_score']}, method: {m['match_method']})")
    print("-" * 60)
    print(f"[image_matcher] Total video duration: ~{total_duration:.1f} seconds ({total_duration/60:.1f} min)")
    
    return {
        "segments": matched,
        "total_segments": len(matched),
        "total_duration_seconds": total_duration,
        "total_images_used": len(set(m["matched_image"] for m in matched if m["matched_image"])),
        "images_available": len(image_files)
    }


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python image_matcher.py <script_file> <images_json> <output_json>")
        sys.exit(1)
    
    script_file = sys.argv[1]
    images_json_file = sys.argv[2]
    output_file = sys.argv[3]
    
    # Script read karo
    with open(script_file, "r", encoding="utf-8") as f:
        script_text = f.read()
    
    # Images list read karo
    with open(images_json_file, "r") as f:
        image_files = json.load(f)
    
    # Match karo
    result = match_script_to_images(script_text, image_files)
    
    # Results save karo
    with open(output_file, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"\n[image_matcher] Results saved to: {output_file}")
    print("[image_matcher] DONE.")
