"use client";

import { useEffect, useState, useCallback } from "react";

interface WorkflowStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
}

interface StatusData {
  jobId: string;
  status: string;
  workflowRunId?: string;
  githubStatus?: string;
  steps?: WorkflowStep[];
  artifactId?: string;
  githubRunUrl?: string;
  errorMessage?: string;
  message?: string;
  createdAt?: string;
  completedAt?: string;
}

interface ProgressTrackerProps {
  jobId: string;
  onCompleted: (artifactId: string | undefined) => void;
  onFailed: (errorMessage: string) => void;
}

// Static step labels for display
const STEP_LABELS = [
  { icon: "📦", name: "Checkout Repository" },
  { icon: "🐍", name: "Setup Python 3.11" },
  { icon: "🎞️", name: "Install FFmpeg" },
  { icon: "📚", name: "Install Python Dependencies" },
  { icon: "📥", name: "Download Images from Google Drive" },
  { icon: "🔗", name: "Match Script to Images" },
  { icon: "🎙️", name: "Generate Voiceover (gTTS)" },
  { icon: "🎬", name: "Render Video with Ken Burns Effect" },
  { icon: "☁️", name: "Upload Video Artifact" },
];

function getStepIcon(step: WorkflowStep, staticStep: { icon: string }): string {
  if (step.conclusion === "success") return "✅";
  if (step.conclusion === "failure") return "❌";
  if (step.status === "in_progress") return "⏳";
  if (step.status === "queued") return "⌛";
  return staticStep.icon;
}

function getStepClass(step: WorkflowStep): string {
  if (step.conclusion === "success") return "text-green-700 bg-green-50 border-green-200";
  if (step.conclusion === "failure") return "text-red-700 bg-red-50 border-red-200";
  if (step.status === "in_progress") return "text-blue-700 bg-blue-50 border-blue-200";
  return "text-gray-500 bg-gray-50 border-gray-200";
}

export default function ProgressTracker({
  jobId,
  onCompleted,
  onFailed,
}: ProgressTrackerProps) {
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [isPolling, setIsPolling] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/workflow-status?jobId=${jobId}`);
      if (!response.ok) return;

      const data: StatusData = await response.json();
      setStatusData(data);

      if (data.status === "completed") {
        setIsPolling(false);
        onCompleted(data.artifactId);
      } else if (data.status === "failed") {
        setIsPolling(false);
        onFailed(data.errorMessage || "Unknown error occurred");
      }
    } catch (error) {
      console.error("Status fetch error:", error);
    }
  }, [jobId, onCompleted, onFailed]);

  // Polling setup
  useEffect(() => {
    fetchStatus();

    if (!isPolling) return;

    const interval = setInterval(() => {
      fetchStatus();
      setPollCount((c) => c + 1);
    }, 10000); // 10 seconds mein poll

    return () => clearInterval(interval);
  }, [fetchStatus, isPolling]);

  // Elapsed time tracker
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  function formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  const steps = statusData?.steps || STEP_LABELS.map((s, i) => ({
    name: s.name,
    status: "queued",
    conclusion: null,
    number: i + 1,
  }));

  const completedSteps = steps.filter((s) => s.conclusion === "success").length;
  const progressPercent = Math.round((completedSteps / steps.length) * 100);
  const currentStep = steps.find((s) => s.status === "in_progress");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">
          🎬 Video Generation Progress
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          GitHub Actions pe rendering ho rahi hai. Har 10 seconds mein update
          hota hai.
        </p>
      </div>

      {/* Overall Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">
            {statusData?.status === "completed"
              ? "✅ Completed!"
              : statusData?.status === "failed"
              ? "❌ Failed"
              : currentStep
              ? `⏳ ${currentStep.name}`
              : "⌛ Queued..."}
          </span>
          <span className="text-gray-500">{progressPercent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              statusData?.status === "completed"
                ? "bg-green-500"
                : statusData?.status === "failed"
                ? "bg-red-500"
                : "bg-blue-500 animate-pulse"
            }`}
            style={{ width: `${progressPercent || (statusData?.status !== "queued" ? 5 : 0)}%` }}
          />
        </div>
      </div>

      {/* Info Bar */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span>🆔 Job: <code className="bg-gray-100 px-1 rounded">{jobId.slice(0, 8)}...</code></span>
        <span>⏱️ Elapsed: <strong>{formatElapsed(elapsedSeconds)}</strong></span>
        {statusData?.workflowRunId && (
          <span>🔢 Run ID: <code className="bg-gray-100 px-1 rounded">{statusData.workflowRunId}</code></span>
        )}
        <span>🔄 Polls: {pollCount + 1}</span>
        {statusData?.githubRunUrl && (
          <a
            href={statusData.githubRunUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            📋 View on GitHub →
          </a>
        )}
      </div>

      {/* Steps List */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">
          Workflow Steps:
        </h3>
        <div className="space-y-1.5">
          {steps.map((step, i) => {
            const staticStep = STEP_LABELS[i] || { icon: "▶️", name: step.name };
            return (
              <div
                key={i}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm transition-all ${getStepClass(step)}`}
              >
                <span className="text-base shrink-0">
                  {getStepIcon(step, staticStep)}
                </span>
                <span className="flex-1 font-medium">
                  {staticStep.name || step.name}
                </span>
                {step.status === "in_progress" && (
                  <span className="text-xs animate-pulse">Running...</span>
                )}
                {step.conclusion === "success" && (
                  <span className="text-xs text-green-600">Done</span>
                )}
                {step.conclusion === "failure" && (
                  <span className="text-xs text-red-600">Failed</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Message */}
      {statusData?.message && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          💬 {statusData.message}
        </div>
      )}

      {/* Error Message */}
      {statusData?.status === "failed" && statusData.errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <p className="font-semibold">❌ Error:</p>
          <p className="mt-1 font-mono text-xs break-all">
            {statusData.errorMessage}
          </p>
        </div>
      )}

      {/* Estimated time */}
      {statusData?.status === "in_progress" && (
        <div className="text-center text-xs text-gray-400">
          ⏳ 20 min video ke liye ~15-18 minutes render time hoga.
          <br />
          Aap ye tab bhi band kar sakte hain — GitHub background mein
          kaam karta rahega.
        </div>
      )}
    </div>
  );
}
