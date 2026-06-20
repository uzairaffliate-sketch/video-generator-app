import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO =
  process.env.GITHUB_REPO || "uzairaffliate-sketch/video-generator-app";
const WORKFLOW_FILE = "generate-video.yml";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scriptText, driveFolderUrl, driveFolderId, language = "en" } = body;

    // Validation
    if (!scriptText || scriptText.trim().length < 10) {
      return NextResponse.json(
        { error: "Script text is required (minimum 10 characters)" },
        { status: 400 }
      );
    }

    if (!driveFolderUrl && !driveFolderId) {
      return NextResponse.json(
        { error: "Google Drive folder URL or ID is required" },
        { status: 400 }
      );
    }

    if (!GITHUB_TOKEN) {
      return NextResponse.json(
        {
          error:
            "GITHUB_TOKEN not configured. Please add it to your .env file.",
        },
        { status: 500 }
      );
    }

    // Extract folder ID from URL
    const folderId =
      driveFolderId || extractFolderIdFromUrl(driveFolderUrl || "");

    if (!folderId) {
      return NextResponse.json(
        {
          error:
            "Could not extract folder ID from the provided Drive URL. Make sure the folder is public.",
        },
        { status: 400 }
      );
    }

    // DB mein job create karo
    const [newJob] = await db
      .insert(jobs)
      .values({
        scriptText: scriptText.trim(),
        driveFolderUrl:
          driveFolderUrl ||
          `https://drive.google.com/drive/folders/${folderId}`,
        driveFolderId: folderId,
        status: "queued",
      })
      .returning();

    // GitHub Actions workflow trigger karo
    const workflowUrl = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

    const githubResponse = await fetch(workflowUrl, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          job_id: newJob.id,
          script_text: scriptText.trim(),
          drive_folder_id: folderId,
          language: language,
        },
      }),
    });

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      console.error("GitHub API Error:", githubResponse.status, errorText);

      // Job ko failed mark karo
      await db
        .update(jobs)
        .set({
          status: "failed",
          errorMessage: `GitHub API Error: ${githubResponse.status} - ${errorText}`,
        })
        .where(eq(jobs.id, newJob.id));

      return NextResponse.json(
        {
          error: `Failed to trigger GitHub workflow: ${githubResponse.status}`,
          details: errorText,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      jobId: newJob.id,
      message:
        "Video generation started! GitHub Actions pe processing ho rahi hai.",
      estimatedTime: "15-20 minutes for a 20-minute video",
    });
  } catch (error) {
    console.error("Trigger workflow error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

function extractFolderIdFromUrl(url: string): string | null {
  if (!url) return null;

  const patterns = [
    /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  // Agar URL nahi balke direct ID hai
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) {
    return url.trim();
  }

  return null;
}
