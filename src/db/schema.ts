import { pgTable, text, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core";

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "in_progress",
  "completed",
  "failed",
]);

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  scriptText: text("script_text").notNull(),
  driveFolderUrl: text("drive_folder_url").notNull(),
  driveFolderId: text("drive_folder_id"),
  workflowRunId: text("workflow_run_id"),
  status: jobStatusEnum("status").default("queued").notNull(),
  artifactId: text("artifact_id"),
  artifactUrl: text("artifact_url"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
