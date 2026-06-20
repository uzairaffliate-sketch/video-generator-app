"use client";

interface Segment {
  index: number;
  text: string;
  word_count: number;
  estimated_duration: number;
  matched_image: string | null;
  match_score: number;
  match_method: string;
}

interface MatchData {
  segments: Segment[];
  total_segments: number;
  total_duration_seconds: number;
  images_available: number;
}

interface ImageMatchPreviewProps {
  matchData: MatchData | null;
  isLoading: boolean;
}

export default function ImageMatchPreview({
  matchData,
  isLoading,
}: ImageMatchPreviewProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-gray-800">
          🔗 Step 3: Image-Script Matching Preview
        </h2>
        <div className="flex items-center justify-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-3">⚙️</div>
            <p className="text-gray-500 text-sm">Matching ho raha hai...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-gray-800">
          🔗 Step 3: Image-Script Matching Preview
        </h2>
        <div className="flex items-center justify-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="text-center">
            <div className="text-4xl mb-3">🔗</div>
            <p className="text-gray-400 text-sm">
              Script aur Drive link dono fill karo phir matching dekho
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { segments, total_segments, total_duration_seconds, images_available } =
    matchData;

  const avgScore =
    segments.reduce((acc, s) => acc + s.match_score, 0) / segments.length;
  const goodMatches = segments.filter((s) => s.match_score >= 0.1).length;
  const fallbackMatches = segments.filter(
    (s) => s.match_method === "sequential_fallback"
  ).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">
          🔗 Image-Script Matching Preview
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Har 5 seconds pe nayi image. Review karo phir video generate karo.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">
            {total_segments}
          </div>
          <div className="text-xs text-blue-500">Total Segments</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-700">
            {Math.round(total_duration_seconds / 60)}m
          </div>
          <div className="text-xs text-purple-500">Video Duration</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{goodMatches}</div>
          <div className="text-xs text-green-500">Good Matches</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-700">
            {images_available}
          </div>
          <div className="text-xs text-orange-500">Images Available</div>
        </div>
      </div>

      {/* Quality Warning */}
      {fallbackMatches > total_segments * 0.5 && (
        <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-medium">Low Matching Quality</p>
            <p className="text-xs mt-0.5">
              {fallbackMatches} segments ko sequential fallback use karna para.
              Image filenames aur script keywords ko align karein for better
              results. Avg score: {(avgScore * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      )}

      {goodMatches === total_segments && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <span>✅</span>
          <p>
            Excellent matching! Avg score:{" "}
            <strong>{(avgScore * 100).toFixed(0)}%</strong> — Video mein images
            perfectly aligned hongi.
          </p>
        </div>
      )}

      {/* Segments Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <div className="col-span-1">#</div>
            <div className="col-span-4">Script Segment</div>
            <div className="col-span-4">Matched Image</div>
            <div className="col-span-2">Score</div>
            <div className="col-span-1">⏱️</div>
          </div>
        </div>

        <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
          {segments.map((seg) => (
            <div
              key={seg.index}
              className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              {/* Segment Number */}
              <div className="col-span-1 flex items-start">
                <span className="text-xs font-mono text-gray-400 mt-0.5">
                  {seg.index + 1}
                </span>
              </div>

              {/* Script Text */}
              <div className="col-span-4">
                <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">
                  {seg.text}
                </p>
                <span className="text-xs text-gray-400 mt-1">
                  {seg.word_count} words
                </span>
              </div>

              {/* Matched Image */}
              <div className="col-span-4">
                {seg.matched_image ? (
                  <div className="flex items-start gap-1.5">
                    <span className="text-sm">
                      {seg.match_method === "sequential_fallback" ? "🔄" : "🖼️"}
                    </span>
                    <div>
                      <p className="text-xs font-mono text-gray-700 break-all">
                        {seg.matched_image}
                      </p>
                      {seg.match_method === "sequential_fallback" && (
                        <span className="text-xs text-orange-500">
                          Fallback (no keyword match)
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-red-500">❌ No image</span>
                )}
              </div>

              {/* Score */}
              <div className="col-span-2">
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        seg.match_score >= 0.3
                          ? "bg-green-500"
                          : seg.match_score >= 0.1
                          ? "bg-yellow-500"
                          : "bg-red-400"
                      }`}
                      style={{
                        width: `${Math.min(seg.match_score * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">
                    {(seg.match_score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Duration */}
              <div className="col-span-1">
                <span className="text-xs text-gray-400">
                  {seg.estimated_duration.toFixed(0)}s
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        💡 Better matching ke liye: image filenames mein script keywords use
        karo (mountain, river, forest, etc.)
      </p>
    </div>
  );
}
