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

    // ✅ Agar job already completed ya failed hai
    if (job.status === "completed") {
      return NextResponse.json({
        jobId: job.id,
        status: "completed",
        workflowRunId: job.workflowRunId,
        artifactId: job.artifactId,
        artifactUrl: job.artifactUrl,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        steps: getStepsForStatus("completed"),
      });
    }

    if (job.status === "failed") {
      return NextResponse.json({
        jobId: job.id,
        status: "failed",
        errorMessage: job.errorMessage || "Workflow failed",
        workflowRunId: job.workflowRunId,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        steps: getStepsForStatus("failed"),
      });
    }

    // ✅ Agar GITHUB_TOKEN nahi hai toh DB status return karo
    if (!GITHUB_TOKEN) {
      return NextResponse.json({
        jobId: job.id,
        status: job.status || "queued",
        message: "GITHUB_TOKEN not configured. Check .env file.",
        steps: getStepsForStatus(job.status || "queued"),
        createdAt: job.createdAt,
      });
    }

    // ✅ GitHub se latest run fetch karo
    let runId = job.workflowRunId;
    let runData = null;
    let steps: WorkflowStep[] = [];

    // Agar workflowRunId nahi hai, toh latest run fetch karo
    if (!runId) {
      const latestRunId = await fetchLatestRunId(jobId);
      if (latestRunId) {
        runId = latestRunId;
        // ✅ Database update karo
        await db
          .update(jobs)
          .set({ 
            workflowRunId: runId,
            status: "in_progress" 
          })
          .where(eq(jobs.id, jobId));
      }
    }

    // Agar runId mil gaya toh status fetch karo
    if (runId) {
      runData = await fetchWorkflowRun(runId);
      if (runData) {
        steps = await fetchWorkflowSteps(runId);

        // ✅ GitHub status ko database status mein map karo
        let dbStatus = job.status;
        let isCompleted = false;
        let isFailed = false;

        if (runData.status === "completed") {
          if (runData.conclusion === "success") {
            dbStatus = "completed";
            isCompleted = true;
          } else {
            dbStatus = "failed";
            isFailed = true;
          }
        } else if (runData.status === "in_progress") {
          dbStatus = "in_progress";
        } else if (runData.status === "queued") {
          dbStatus = "queued";
        }

        // ✅ Agar status change hua hai toh database update karo
        if (dbStatus !== job.status) {
          const updateData: any = { status: dbStatus };
          if (isCompleted) {
            updateData.completedAt = new Date();
            // ✅ Artifact fetch karo
            const artifact = await fetchArtifact(jobId);
            if (artifact) {
              updateData.artifactId = String(artifact.id);
              updateData.artifactUrl = artifact.archive_download_url;
            }
          }
          if (isFailed) {
            updateData.errorMessage = runData.conclusion || "Workflow failed";
            updateData.completedAt = new Date();
          }
          await db
            .update(jobs)
            .set(updateData)
            .where(eq(jobs.id, jobId));
        }

        // ✅ Response return karo
        return NextResponse.json({
          jobId: job.id,
          status: dbStatus,
          workflowRunId: runId,
          githubStatus: runData.status,
          githubConclusion: runData.conclusion,
          githubRunUrl: runData.html_url,
          steps: steps.length > 0 ? steps : getStepsForStatus(dbStatus),
          artifactId: job.artifactId,
          errorMessage: job.errorMessage,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          message: getStatusMessage(dbStatus),
        });
      }
    }

    // ✅ Agar GitHub se kuch nahi mila, DB status return karo
    return NextResponse.json({
      jobId: job.id,
      status: job.status || "queued",
      workflowRunId: job.workflowRunId,
      steps: getStepsForStatus(job.status || "queued"),
      message: getStatusMessage(job.status || "queued"),
      createdAt: job.createdAt,
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

    // ✅ Job ID se matching run dhoondho (inputs mein job_id check karo)
    for (const run of runs) {
      if (run.inputs && run.inputs.job_id === jobId) {
        return String(run.id);
      }
    }

    // Agar match nahi mila, toh most recent return karo
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

  const statusMap: Record<string, string> = {
    completed: "completed",
    failed: "failed",
    in_progress: "in_progress",
    queued: "queued",
  };

  const stepStatus = statusMap[status] || "queued";
  const stepConclusion = status === "completed" ? "success" : status === "failed" ? "failure" : null;

  return allSteps.map((name, i) => ({
    name,
    status: stepStatus,
    conclusion: stepConclusion,
    number: i + 1,
  }));
}
