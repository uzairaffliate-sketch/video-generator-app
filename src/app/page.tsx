"use client";

import { useState, useCallback } from "react";
import ScriptInput from "./components/ScriptInput";
import DriveInput from "./components/DriveInput";
import ImageMatchPreview from "./components/ImageMatchPreview";
import ProgressTracker from "./components/ProgressTracker";
import VideoDownload from "./components/VideoDownload";

type AppStep = "input" | "generating" | "done" | "failed";

interface MatchData {
  segments: Array<{
    index: number;
    text: string;
    word_count: number;
    estimated_duration: number;
    matched_image: string | null;
    match_score: number;
    match_method: string;
  }>;
  total_segments: number;
  total_duration_seconds: number;
  images_available: number;
}

// Mock image names based on common keywords (since we preview client-side)
function generateMockImageNames(script: string): string[] {
  const keywords = script
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 20);

  return keywords.map((kw, i) => `${kw}_scene_${i + 1}.jpg`);
}

export default function HomePage() {
  const [step, setStep] = useState<AppStep>("input");
  const [scriptText, setScriptText] = useState("");
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [language, setLanguage] = useState("en");
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [isMatchLoading, setIsMatchLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [failedError, setFailedError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Preview matching when both script and drive link are filled
  async function handlePreviewMatch() {
    if (!scriptText.trim() || !driveFolderId) return;

    setIsMatchLoading(true);

    try {
      // Use mock names for preview (actual matching happens on GitHub Actions)
      const mockNames = generateMockImageNames(scriptText);

      const response = await fetch("/api/preview-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptText: scriptText.trim(),
          imageNames: mockNames,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMatchData(data);
      }
    } catch (error) {
      console.error("Preview match error:", error);
    } finally {
      setIsMatchLoading(false);
    }
  }

  async function handleGenerateVideo() {
    if (!scriptText.trim() || !driveFolderId) return;

    setIsGenerating(true);
    setGenerateError(null);

    try {
      const response = await fetch("/api/trigger-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptText: scriptText.trim(),
          driveFolderUrl,
          driveFolderId,
          language,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setGenerateError(data.error || "Failed to start video generation");
        return;
      }

      setJobId(data.jobId);
      setStep("generating");
    } catch (error) {
      setGenerateError("Network error. Please try again.");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  }

  const handleCompleted = useCallback((_artifactId: string | undefined) => {
    setStep("done");
  }, []);

  const handleFailed = useCallback((errorMessage: string) => {
    setFailedError(errorMessage);
    setStep("failed");
  }, []);

  function handleReset() {
    setStep("input");
    setScriptText("");
    setDriveFolderUrl("");
    setDriveFolderId(null);
    setMatchData(null);
    setJobId(null);
    setFailedError(null);
    setGenerateError(null);
    setLanguage("en");
  }

  const canPreview =
    scriptText.trim().length >= 10 && driveFolderId !== null;

  const canGenerate = canPreview;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🎬</div>
            <div>
              <h1 className="text-xl font-bold text-white">
                AI Video Generator
              </h1>
              <p className="text-xs text-slate-400">
                Script → Voice → Ken Burns Video via GitHub Actions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 bg-green-900/50 text-green-400 rounded-full border border-green-800">
              ✅ 100% Free
            </span>
            <span className="px-2 py-1 bg-blue-900/50 text-blue-400 rounded-full border border-blue-800">
              ⚡ GitHub Actions
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Step Indicator (only on input step) */}
        {step === "input" && (
          <div className="flex items-center gap-2 text-sm">
            {[
              { num: 1, label: "Script" },
              { num: 2, label: "Drive Link" },
              { num: 3, label: "Review & Generate" },
            ].map((s, i) => (
              <div key={s.num} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 rounded-full text-slate-300">
                  <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold shrink-0">
                    {s.num}
                  </span>
                  <span>{s.label}</span>
                </div>
                {i < 2 && <span className="text-slate-600">→</span>}
              </div>
            ))}
          </div>
        )}

        {/* ── INPUT STEP ─────────────────────────────────────────────────────── */}
        {step === "input" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Script + Drive */}
            <div className="space-y-6">
              {/* Script Input */}
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <ScriptInput
                  value={scriptText}
                  onChange={setScriptText}
                  language={language}
                  onLanguageChange={setLanguage}
                />
              </div>

              {/* Drive Input */}
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <DriveInput
                  value={driveFolderUrl}
                  onChange={setDriveFolderUrl}
                  onFolderIdExtracted={setDriveFolderId}
                />
              </div>

              {/* Preview Match Button */}
              <button
                onClick={handlePreviewMatch}
                disabled={!canPreview || isMatchLoading}
                className="w-full py-3 px-6 bg-slate-700 hover:bg-slate-600 
                           disabled:bg-slate-800 disabled:text-slate-600
                           text-white rounded-xl font-medium text-sm transition-colors 
                           flex items-center justify-center gap-2 border border-slate-600"
              >
                {isMatchLoading ? (
                  <>
                    <span className="animate-spin">⚙️</span> Matching...
                  </>
                ) : (
                  <>🔗 Preview Image Matching</>
                )}
              </button>
            </div>

            {/* Right Column: Match Preview + Generate */}
            <div className="space-y-6">
              {/* Image Match Preview */}
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <ImageMatchPreview
                  matchData={matchData}
                  isLoading={isMatchLoading}
                />
              </div>

              {/* Generate Error */}
              {generateError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <p className="font-semibold">❌ Error:</p>
                  <p className="mt-1">{generateError}</p>
                  {generateError.includes("GITHUB_TOKEN") && (
                    <p className="mt-2 text-xs bg-red-100 p-2 rounded font-mono">
                      .env mein add karo:
                      <br />
                      GITHUB_TOKEN=ghp_your_token_here
                      <br />
                      GITHUB_REPO=uzairaffliate-sketch/video-generator-app
                    </p>
                  )}
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerateVideo}
                disabled={!canGenerate || isGenerating}
                className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 
                           hover:from-blue-700 hover:to-indigo-700
                           disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed
                           text-white rounded-xl font-bold text-lg transition-all 
                           flex items-center justify-center gap-3 shadow-lg shadow-blue-900/30"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin text-xl">⏳</span>
                    GitHub Actions Trigger Ho Raha Hai...
                  </>
                ) : (
                  <>
                    🚀 Generate Video
                  </>
                )}
              </button>

              {!canGenerate && (
                <p className="text-center text-sm text-slate-400">
                  Script aur Drive folder link dono fill karo generate karne ke liye
                </p>
              )}

              {/* How it works */}
              <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-300 space-y-2 border border-slate-700">
                <p className="font-semibold text-white">⚡ Kya Hoga?</p>
                <div className="space-y-1.5 text-xs">
                  {[
                    "GitHub Actions Ubuntu server start hoga",
                    "Python + FFmpeg + MoviePy install hoga",
                    "Drive se images download hongi",
                    "Script → MP3 voice (gTTS, free)",
                    "Ken Burns effect ke sath video render hogi",
                    "GitHub Artifacts mein 90 days ke liye save hogi",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-slate-700 text-slate-400 rounded-full text-xs flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── GENERATING STEP ─────────────────────────────────────────────── */}
        {step === "generating" && jobId && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
              <ProgressTracker
                jobId={jobId}
                onCompleted={handleCompleted}
                onFailed={handleFailed}
              />
            </div>
          </div>
        )}

        {/* ── DONE STEP ────────────────────────────────────────────────────── */}
        {step === "done" && jobId && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
              <VideoDownload jobId={jobId} onReset={handleReset} />
            </div>
          </div>
        )}

        {/* ── FAILED STEP ──────────────────────────────────────────────────── */}
        {step === "failed" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">❌</span>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Video Generation Failed
                  </h2>
                  <p className="text-sm text-gray-500">
                    GitHub Actions mein koi error aayi
                  </p>
                </div>
              </div>

              {failedError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-mono break-all">
                  {failedError}
                </div>
              )}

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 space-y-1.5">
                <p className="font-semibold text-gray-700">
                  🔧 Common Solutions:
                </p>
                <ul className="list-disc ml-4 space-y-1 text-xs">
                  <li>Google Drive folder public hai? (Anyone with link → Viewer)</li>
                  <li>Image files JPG/PNG format mein hain?</li>
                  <li>GITHUB_TOKEN ki permissions sahi hain? (Actions: Read/Write)</li>
                  <li>
                    GitHub repo mein workflow file hai?
                    (.github/workflows/generate-video.yml)
                  </li>
                  <li>
                    GitHub Actions ke detailed logs check karo repository mein
                  </li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white 
                             rounded-xl font-medium text-sm transition-colors"
                >
                  🔄 Dobara Try Karo
                </button>
                <a
                  href={`https://github.com/${process.env.NEXT_PUBLIC_GITHUB_REPO || "uzairaffliate-sketch/video-generator-app"}/actions`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-900 text-white 
                             rounded-xl font-medium text-sm transition-colors text-center"
                >
                  📋 GitHub Logs Dekho
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-700 py-6 text-center text-xs text-slate-500">
        <p>
          🎬 AI Video Generator — 100% Free using GitHub Actions + gTTS + MoviePy
        </p>
        <p className="mt-1">
          Images: Google Drive Public Folder | Voice: Google TTS | Video: FFmpeg + Ken Burns Effect
        </p>
      </footer>
    </div>
  );
}
