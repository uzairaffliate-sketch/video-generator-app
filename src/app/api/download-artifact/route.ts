import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO =
  process.env.GITHUB_REPO || "uzairaffliate-sketch/video-generator-app";

// ✅ Artifact name dynamic hai - workflow mein "video-${{ inputs.job_id }}" use ho raha hai
function getArtifactName(jobId: string) {
  return `video-${jobId}`;
}

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

    if (!GITHUB_TOKEN) {
      return NextResponse.json(
        { error: "GITHUB_TOKEN not configured" },
        { status: 500 }
      );
    }

    // Step 1: DB se job fetch karo
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Step 2: Status check with proper handling
    if (job.status === "queued" || job.status === "in_progress") {
      return NextResponse.json(
        {
          error: "Video is still being generated. Please wait...",
          status: job.status,
          message: "Check back in a few minutes",
          estimatedTime: "2-5 minutes",
        },
        { status: 202 }
      );
    }

    if (job.status === "failed") {
      return NextResponse.json(
        {
          error: "Video generation failed",
          status: job.status,
          message: job.error_message || "Unknown error occurred",
        },
        { status: 500 }
      );
    }

    if (job.status !== "completed") {
      return NextResponse.json(
        {
          error: `Unexpected status: ${job.status}`,
          status: job.status,
        },
        { status: 400 }
      );
    }

    // Step 3: Artifact fetch karo - dynamic name se
    const artifactNames = [
      getArtifactName(jobId), // ✅ Yeh pehle try hoga - "video-{jobId}"
      `video-${jobId}`,
      `${jobId}.mp4`,
      "final_video.mp4",
      "output.mp4",
      "video",
      "video-artifact",
    ];

    const listUrl = `https://api.github.com/repos/${GITHUB_REPO}/actions/artifacts?per_page=100`;
    const listResponse = await fetch(listUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!listResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch artifacts from GitHub" },
        { status: 500 }
      );
    }

    const listData = await listResponse.json();

    // Multiple names try karo
    let artifact = null;
    let foundName = "";

    for (const name of artifactNames) {
      const found = listData.artifacts?.find(
        (a: { name: string; expired: boolean }) =>
          a.name === name && !a.expired
      );
      if (found) {
        artifact = found;
        foundName = name;
        break;
      }
    }

    // Agar artifact nahi mila, toh saare available artifacts show karo (debugging)
    if (!artifact) {
      const availableArtifacts = listData.artifacts?.map((a: any) => a.name) || [];
      return NextResponse.json(
        {
          error: "Artifact not found or expired. GitHub artifacts expire after 90 days.",
          searchedNames: artifactNames,
          availableArtifacts: availableArtifacts,
          message: "Check your GitHub Actions workflow artifact name",
        },
        { status: 404 }
      );
    }

    // Success - Return download info
    const downloadUrl = `https://api.github.com/repos/${GITHUB_REPO}/actions/artifacts/${artifact.id}/zip`;

    return NextResponse.json({
      success: true,
      jobId,
      artifactId: String(artifact.id),
      artifactName: foundName,
      artifactSize: artifact.size_in_bytes,
      artifactSizeMB: (artifact.size_in_bytes / (1024 * 1024)).toFixed(1),
      expiresAt: artifact.expires_at,
      downloadUrl,
      githubDownloadUrl: `https://github.com/${GITHUB_REPO}/actions/runs/${job.workflowRunId}/artifacts/${artifact.id}`,
      note: "Use POST method or githubDownloadUrl to actually download the file",
    });

  } catch (error) {
    console.error("Download artifact error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

// POST: Direct artifact download proxy
export async function POST(req: NextRequest) {
  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId is required" },
        { status: 400 }
      );
    }

    if (!GITHUB_TOKEN) {
      return NextResponse.json(
        { error: "GITHUB_TOKEN not configured" },
        { status: 500 }
      );
    }

    // Pehle DB se status check karo
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status === "queued" || job.status === "in_progress") {
      return NextResponse.json(
        {
          error: "Video is still being generated",
          status: job.status,
        },
        { status: 202 }
      );
    }

    if (job.status !== "completed") {
      return NextResponse.json(
        {
          error: `Job status is ${job.status}, cannot download`,
        },
        { status: 400 }
      );
    }

    // Multiple artifact names try karo
    const artifactNames = [
      getArtifactName(jobId), // ✅ Dynamic name - "video-{jobId}"
      `video-${jobId}`,
      `${jobId}.mp4`,
      "final_video.mp4",
      "output.mp4",
      "video",
      "video-artifact",
    ];

    const listUrl = `https://api.github.com/repos/${GITHUB_REPO}/actions/artifacts?per_page=100`;
    const listResponse = await fetch(listUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!listResponse.ok) {
      return NextResponse.json(
        { error: "Failed to list artifacts" },
        { status: 500 }
      );
    }

    const listData = await listResponse.json();

    let artifact = null;
    for (const name of artifactNames) {
      const found = listData.artifacts?.find(
        (a: { name: string; expired: boolean }) =>
          a.name === name && !a.expired
      );
      if (found) {
        artifact = found;
        break;
      }
    }

    if (!artifact) {
      const availableArtifacts = listData.artifacts?.map((a: any) => a.name) || [];
      return NextResponse.json(
        {
          error: "Artifact not found",
          searchedNames: artifactNames,
          availableArtifacts: availableArtifacts,
        },
        { status: 404 }
      );
    }

    // Artifact download karo
    const downloadResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/artifacts/${artifact.id}/zip`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        redirect: "follow",
      }
    );

    if (!downloadResponse.ok) {
      return NextResponse.json(
        { error: "Failed to download artifact" },
        { status: 500 }
      );
    }

    // ZIP file stream karo
    const blob = await downloadResponse.arrayBuffer();

    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${getArtifactName(jobId)}.zip"`,
        "Content-Length": String(blob.byteLength),
      },
    });

  } catch (error) {
    console.error("Proxy download error:", error);
    return NextResponse.json(
      { error: "Download failed", details: String(error) },
      { status: 500 }
    );
  }
}
