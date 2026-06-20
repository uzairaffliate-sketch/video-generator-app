import { NextRequest, NextResponse } from "next/server";

// Words per second estimate
const WORDS_PER_SECOND = 2.5;
const WORDS_PER_SEGMENT = Math.floor(WORDS_PER_SECOND * 5); // ~12 words per 5-sec segment

const STOP_WORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might","shall","can",
  "to","of","in","on","at","by","for","with","about","from","up","down","and",
  "but","or","nor","so","this","that","these","those","i","me","my","we","our",
  "you","your","he","she","it","its","they","them","their","what","which","who",
  "when","where","why","how","all","each","every","any","no","not","just","very",
]);

function extractKeywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const kw = new Set<string>();
  for (const word of words) {
    kw.add(word);
    if (word.endsWith("ing") && word.length > 5) kw.add(word.slice(0, -3));
    if (word.endsWith("ed") && word.length > 4) kw.add(word.slice(0, -2));
    if (word.endsWith("s") && word.length > 3) kw.add(word.slice(0, -1));
  }
  return kw;
}

function cleanFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\d+/g, "")
    .toLowerCase()
    .trim();
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  const jaccard = intersection.size / union.size;
  const bonus = intersection.size / Math.max(b.size, 1) * 0.3;
  return Math.min(jaccard + bonus, 1.0);
}

function splitIntoSegments(script: string) {
  const sentences = script
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const segments: Array<{
    index: number;
    text: string;
    word_count: number;
    estimated_duration: number;
  }> = [];

  let currentWords: string[] = [];
  let currentSentences: string[] = [];
  let segIdx = 0;

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);

    if (
      currentWords.length &&
      currentWords.length + words.length > WORDS_PER_SEGMENT * 1.5
    ) {
      segments.push({
        index: segIdx++,
        text: currentSentences.join(" "),
        word_count: currentWords.length,
        estimated_duration: currentWords.length / WORDS_PER_SECOND,
      });
      currentWords = [];
      currentSentences = [];
    }

    currentWords.push(...words);
    currentSentences.push(sentence);

    if (currentWords.length >= WORDS_PER_SEGMENT) {
      segments.push({
        index: segIdx++,
        text: currentSentences.join(" "),
        word_count: currentWords.length,
        estimated_duration: currentWords.length / WORDS_PER_SECOND,
      });
      currentWords = [];
      currentSentences = [];
    }
  }

  if (currentWords.length) {
    segments.push({
      index: segIdx++,
      text: currentSentences.join(" "),
      word_count: currentWords.length,
      estimated_duration: currentWords.length / WORDS_PER_SECOND,
    });
  }

  return segments;
}

export async function POST(req: NextRequest) {
  try {
    const { scriptText, imageNames } = await req.json();

    if (!scriptText || !imageNames || !Array.isArray(imageNames)) {
      return NextResponse.json(
        { error: "scriptText and imageNames[] required" },
        { status: 400 }
      );
    }

    const segments = splitIntoSegments(scriptText);

    // Precompute image keywords
    const imageKeywords = imageNames.map((name: string) => ({
      name,
      keywords: extractKeywords(cleanFilename(name)),
    }));

    // Match segments to images
    const matched = segments.map((seg) => {
      const segKw = extractKeywords(seg.text);
      let bestImg = imageNames[seg.index % imageNames.length] as string;
      let bestScore = 0;
      let bestMethod = "sequential_fallback";

      for (const img of imageKeywords) {
        const score = similarity(segKw, img.keywords);
        if (score > bestScore) {
          bestScore = score;
          bestImg = img.name;
          bestMethod = "keyword_match";
        }
      }

      if (bestScore < 0.05) {
        bestImg = imageNames[seg.index % imageNames.length] as string;
        bestMethod = "sequential_fallback";
        bestScore = 0;
      }

      return {
        ...seg,
        matched_image: bestImg,
        match_score: Math.round(bestScore * 1000) / 1000,
        match_method: bestMethod,
      };
    });

    const totalDuration = segments.reduce(
      (acc, s) => acc + s.estimated_duration,
      0
    );

    return NextResponse.json({
      segments: matched,
      total_segments: matched.length,
      total_duration_seconds: totalDuration,
      images_available: imageNames.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Match preview failed", details: String(error) },
      { status: 500 }
    );
  }
}
