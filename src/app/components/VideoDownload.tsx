"use client";

import { useState, useEffect } from "react";

interface ArtifactInfo {
  artifactId: string;
  artifactName: string;
  artifactSizeMB: string;
  expiresAt: string;
  githubDownloadUrl: string;
  downloadUrl: string;
}

interface VideoDownloadProps {
  jobId: string;
  onReset: () => void;
}

export default function VideoDownload({ jobId, onReset }: VideoDownloadProps) {
  const [artifactInfo, setArtifactInfo] = useState<ArtifactInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArtifactInfo() {
      try {
        const response = await fetch(`/api/download-artifact?jobId=${jobId}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to fetch download info");
          return;
        }

        setArtifactInfo(data);
      } catch (err) {
        setError("Network error. Please try again.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchArtifactInfo();
  }, [jobId]);

  async function handleDirectDownload() {
    if (!artifactInfo) return;
    setIsDownloading(true);

    try {
      // Server-side proxy ke through download karo
      const response = await fetch("/api/download-artifact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) {
        throw new Error("Download failed");
      }

      // ZIP file download karo
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video-${jobId.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      // Fallback: GitHub pe redirect karo
      if (artifactInfo.githubDownloadUrl) {
        window.open(artifactInfo.githubDownloadUrl, "_blank");
      }
    } finally {
      setIsDownloading(false);
    }
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString("en-PK", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin text-4xl mb-3">⚙️</div>
        <p className="text-gray-500">Download info fetch ho rahi hai...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <span className="text-2xl">❌</span>
          <div>
            <p className="font-semibold text-red-700">Download Error</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={onReset}
          className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 
                     rounded-lg text-sm font-medium transition-colors"
        >
          ← Naya Video Banao
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-green-500 to-emerald-600 
                      rounded-xl text-white shadow-lg">
        <div className="text-5xl">🎉</div>
        <div>
          <h2 className="text-2xl font-bold">Video Ready Hai!</h2>
          <p className="text-green-100 text-sm mt-0.5">
            Aapki video successfully generate ho gayi. Ab download karein.
          </p>
        </div>
      </div>

      {/* Artifact Info Card */}
      {artifactInfo && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-700 text-sm">
              📁 File Details
            </h3>
          </div>
          <div className="p-4 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">File Name:</span>
              <span className="font-mono text-gray-800 font-medium">
                {artifactInfo.artifactName}.zip
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Size:</span>
              <span className="font-semibold text-gray-800">
                ~{artifactInfo.artifactSizeMB} MB
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Format:</span>
              <span className="text-gray-800">MP4 (H.264, 1080p)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Quality:</span>
              <span className="text-gray-800">4000k bitrate, 25fps</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Expires:</span>
              <span className="text-orange-600 font-medium">
                {formatDate(artifactInfo.expiresAt)} (90 days)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Download Buttons */}
      <div className="space-y-3">
        {/* Primary: Direct Download */}
        <button
          onClick={handleDirectDownload}
          disabled={isDownloading}
          className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                     text-white rounded-xl font-semibold text-base transition-colors 
                     flex items-center justify-center gap-3 shadow-md"
        >
          {isDownloading ? (
            <>
              <span className="animate-spin">⏳</span>
              Downloading...
            </>
          ) : (
            <>
              ⬇️ Download Video (ZIP)
            </>
          )}
        </button>

        {/* Secondary: Open GitHub */}
        {artifactInfo?.githubDownloadUrl && (
          <a
            href={artifactInfo.githubDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-6 bg-gray-800 hover:bg-gray-900 text-white 
                       rounded-xl font-medium text-sm transition-colors flex items-center 
                       justify-center gap-2"
          >
            🐙 GitHub Pe Open Karo (Login Required)
          </a>
        )}
      </div>

      {/* Instructions */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 space-y-2">
        <p className="font-semibold">📌 Download Instructions:</p>
        <ol className="list-decimal ml-4 space-y-1 text-xs">
          <li>
            &quot;Download Video (ZIP)&quot; button dabao — ZIP file download
            hogi
          </li>
          <li>ZIP extract karo — andar final_video.mp4 milega</li>
          <li>
            Agar direct download fail ho, GitHub wala button use karo (GitHub
            login zaroori hai)
          </li>
          <li>
            ⚠️ File 90 days mein expire ho jati hai. Jaldi download kar lein!
          </li>
        </ol>
      </div>

      {/* Reset Button */}
      <button
        onClick={onReset}
        className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 
                   rounded-lg text-sm font-medium transition-colors border border-gray-200"
      >
        🔄 Nayi Video Banao
      </button>
    </div>
  );
}
