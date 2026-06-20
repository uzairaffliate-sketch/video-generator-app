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

    if (!GITHUB_TOKEN) {
      return NextResponse.json(
        { error: "GITHUB_TOKEN not configured" },
        { status: 500 }
      );
    }

    // DB se job fetch karo
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status !== "completed") {
      return NextResponse.json(
        {
          error: "Video is not ready yet",
          status: job.status,
        },
        { status: 400 }
      );
    }

    // Artifact ID se download URL fetch karo
    const artifactName = `video-${jobId}`;

    // GitHub artifacts list fetch karo
    const listUrl = `https://api.github.com/repos/${GITHUB_REPO}/actions/artifacts?per_page=50`;
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
    const artifact = listData.artifacts?.find(
      (a: { name: string; expired: boolean }) =>
        a.name === artifactName && !a.expired
    );

    if (!artifact) {
      return NextResponse.json(
        {
          error:
            "Artifact not found or expired. GitHub artifacts expire after 90 days.",
          artifactName,
        },
        { status: 404 }
      );
    }

    // Download URL generate karo
    // Note: GitHub artifact download requires redirect - we proxy it
    const downloadUrl = `https://api.github.com/repos/${GITHUB_REPO}/actions/artifacts/${artifact.id}/zip`;

    // Artifact info return karo with download instructions
    return NextResponse.json({
      success: true,
      jobId,
      artifactId: String(artifact.id),
      artifactName,
      artifactSize: artifact.size_in_bytes,
      artifactSizeMB: (artifact.size_in_bytes / (1024 * 1024)).toFixed(1),
      expiresAt: artifact.expires_at,
      downloadUrl,
      // Direct browser download link (requires auth)
      githubDownloadUrl: `https://github.com/${GITHUB_REPO}/actions/runs/${job.workflowRunId}/artifacts/${artifact.id}`,
      // Instructions
      note: "Use the githubDownloadUrl to download directly from GitHub (you must be logged in to GitHub)",
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

    if (!jobId || !GITHUB_TOKEN) {
      return NextResponse.json(
        { error: "Missing jobId or token" },
        { status: 400 }
      );
    }

    const artifactName = `video-${jobId}`;

    // Artifact list fetch karo
    const listUrl = `https://api.github.com/repos/${GITHUB_REPO}/actions/artifacts?per_page=50`;
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
    const artifact = listData.artifacts?.find(
      (a: { name: string; expired: boolean }) =>
        a.name === artifactName && !a.expired
    );

    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }

    // Artifact download karo (ZIP format)
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

    // Stream the ZIP file to client
    const blob = await downloadResponse.arrayBuffer();

    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="video-${jobId}.zip"`,
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
