import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO =
  process.env.GITHUB_REPO || "uzairaffliate-sketch/video-generator-app";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId parameter is required" },
        { status: 400 }
      );
    }

    // DB se job fetch karo
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Agar job already completed ya failed hai
    if (job.status === "completed" || job.status === "failed") {
      return NextResponse.json({
        jobId: job.id,
        status: job.status,
        workflowRunId: job.workflowRunId,
        artifactId: job.artifactId,
        artifactUrl: job.artifactUrl,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        steps: getStepsForStatus(job.status),
      });
    }

    // GitHub API se live status check karo
    let githubStatus = null;
    let workflowSteps: WorkflowStep[] = [];

    if (GITHUB_TOKEN) {
      // Agar workflow run ID nahi hai, latest run fetch karo
      let runId = job.workflowRunId;

      if (!runId) {
        runId = await fetchLatestRunId(job.id);
        if (runId) {
          await db
            .update(jobs)
            .set({ workflowRunId: runId, status: "in_progress" })
            .where(eq(jobs.id, jobId));
        }
      }

      if (runId) {
        const runData = await fetchWorkflowRun(runId);
        if (runData) {
          githubStatus = runData.status;
          workflowSteps = await fetchWorkflowSteps(runId);

          // Status update karo
          if (runData.status === "completed") {
            const conclusion = runData.conclusion;
            const newStatus = conclusion === "success" ? "completed" : "failed";

            // Artifact fetch karo agar success hai
            let artifactData = null;
            if (newStatus === "completed") {
              artifactData = await fetchArtifact(job.id);
            }

            await db
              .update(jobs)
              .set({
                status: newStatus,
                completedAt: new Date(),
                artifactId: artifactData?.id ? String(artifactData.id) : null,
                errorMessage:
                  conclusion !== "success"
                    ? `Workflow ${conclusion}`
                    : null,
              })
              .where(eq(jobs.id, jobId));

            return NextResponse.json({
              jobId: job.id,
              status: newStatus,
              workflowRunId: runId,
              artifactId: artifactData?.id ? String(artifactData.id) : null,
              githubRunUrl: runData.html_url,
              conclusion: conclusion,
              steps: workflowSteps,
              createdAt: job.createdAt,
              completedAt: new Date(),
            });
          }
        }
      }
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      workflowRunId: job.workflowRunId,
      githubStatus,
      steps: workflowSteps.length > 0 ? workflowSteps : getStepsForStatus(job.status),
      createdAt: job.createdAt,
      message: getStatusMessage(job.status),
    });
  } catch (error) {
    console.error("Workflow status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch status", details: String(error) },
      { status: 500 }
    );
  }
}

// ─── Helper Functions ──────────────────────────────────────────────────────

interface WorkflowStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
}

async function fetchLatestRunId(jobId: string): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/runs?event=workflow_dispatch&per_page=10`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const runs = data.workflow_runs || [];

    // Most recent run return karo
    if (runs.length > 0) {
      return String(runs[0].id);
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchWorkflowRun(runId: string) {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${runId}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchWorkflowSteps(runId: string): Promise<WorkflowStep[]> {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${runId}/jobs`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    const jobs_data = data.jobs || [];

    if (jobs_data.length === 0) return [];

    const steps = jobs_data[0].steps || [];
    return steps.map((step: WorkflowStep) => ({
      name: step.name,
      status: step.status,
      conclusion: step.conclusion,
      number: step.number,
    }));
  } catch {
    return [];
  }
}

async function fetchArtifact(jobId: string) {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/artifacts?per_page=20`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const artifacts = data.artifacts || [];

    // Job ID wala artifact dhundo
    const artifact = artifacts.find(
      (a: { name: string }) => a.name === `video-${jobId}`
    );
    return artifact || null;
  } catch {
    return null;
  }
}

function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    queued: "Workflow queue mein hai. GitHub Actions shuru hone wala hai...",
    in_progress: "GitHub Actions pe video render ho rahi hai...",
    completed: "Video successfully generate ho gayi!",
    failed: "Video generation failed. Logs check karein.",
  };
  return messages[status] || "Processing...";
}

function getStepsForStatus(status: string): WorkflowStep[] {
  const allSteps = [
    "Checkout Repository",
    "Setup Python 3.11",
    "Install FFmpeg",
    "Install Python Dependencies",
    "Download Images from Google Drive",
    "Match Script to Images",
    "Generate Voiceover",
    "Render Video with Ken Burns Effect",
    "Upload Video Artifact",
  ];

  return allSteps.map((name, i) => ({
    name,
    status: status === "completed" ? "completed" : status === "queued" ? "queued" : "in_progress",
    conclusion: status === "completed" ? "success" : null,
    number: i + 1,
  }));
}
