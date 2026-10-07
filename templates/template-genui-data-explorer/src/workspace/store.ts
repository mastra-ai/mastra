import { DatabaseSync } from "node:sqlite";

import { workspaceSchema } from "./contracts.ts";
import type { Workspace } from "./contracts.ts";

export class WorkspaceError extends Error {
  readonly code:
    | "stale-revision"
    | "persistence-failure"
    | "invalid-input"
    | "recovery-required"
    | "invalid-composition";
  constructor(
    code:
      | "stale-revision"
      | "persistence-failure"
      | "invalid-input"
      | "recovery-required"
      | "invalid-composition",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}
export class WorkspaceStore {
  readonly #db: DatabaseSync;
  constructor(path: string) {
    this.#db = new DatabaseSync(path);
    this.#db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS requests (workspace_id TEXT NOT NULL, request_id TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL, response TEXT, PRIMARY KEY(workspace_id,request_id));",
    );
  }
  load(id: string): Workspace | undefined {
    const row = this.#db.prepare("SELECT json FROM workspaces WHERE id=?").get(id);
    if (!row) return undefined;
    if (typeof row.json !== "string")
      throw new WorkspaceError(
        "recovery-required",
        "Saved workspace is invalid. Restore a compatible local store.",
      );
    return workspaceSchema.parse(JSON.parse(row.json));
  }
  request(
    workspaceId: string,
    requestId: string,
    payload: string,
  ): { status: string; response?: unknown } | undefined {
    const row = this.#db
      .prepare("SELECT payload,status,response FROM requests WHERE workspace_id=? AND request_id=?")
      .get(workspaceId, requestId);
    if (!row) return undefined;
    if (row.payload !== payload)
      throw new WorkspaceError(
        "invalid-input",
        "A request ID cannot be reused with different input.",
      );
    if (typeof row.status !== "string")
      throw new WorkspaceError("persistence-failure", "The request journal is invalid.");
    return {
      status: row.status,
      ...(typeof row.response === "string" ? { response: JSON.parse(row.response) } : {}),
    };
  }
  latest(
    workspaceId: string,
  ): { requestId: string; status: string; message?: string; question?: string } | undefined {
    const row = this.#db
      .prepare(
        "SELECT request_id,status,response,payload FROM requests WHERE workspace_id=? ORDER BY rowid DESC LIMIT 1",
      )
      .get(workspaceId);
    if (!row || typeof row.request_id !== "string" || typeof row.status !== "string")
      return undefined;
    const response: unknown =
      typeof row.response === "string" ? JSON.parse(row.response) : undefined;
    const message =
      response &&
      typeof response === "object" &&
      "message" in response &&
      typeof response.message === "string"
        ? response.message
        : undefined;
    const payload: unknown = typeof row.payload === "string" ? JSON.parse(row.payload) : undefined;
    const question =
      payload &&
      typeof payload === "object" &&
      "question" in payload &&
      typeof payload.question === "string"
        ? payload.question
        : undefined;
    return {
      requestId: row.request_id,
      status: row.status,
      ...(message ? { message } : {}),
      ...(question ? { question } : {}),
    };
  }
  begin(workspaceId: string, requestId: string, payload: string): void {
    try {
      this.#db
        .prepare("INSERT INTO requests VALUES (?,?,?,'running',NULL)")
        .run(workspaceId, requestId, payload);
    } catch {
      throw new WorkspaceError(
        "persistence-failure",
        "Could not record the request. The last saved workspace is preserved. Correct local storage and retry with a new request ID.",
      );
    }
  }
  finish(workspaceId: string, requestId: string, response: unknown): void {
    this.#db
      .prepare(
        "UPDATE requests SET status='incomplete',response=? WHERE workspace_id=? AND request_id=? AND status='running'",
      )
      .run(JSON.stringify(response), workspaceId, requestId);
  }
  commit(baseRevision: number, workspace: Workspace, requestId: string, response: unknown): void {
    workspaceSchema.parse(workspace);
    try {
      this.#db.exec("BEGIN IMMEDIATE");
      const existing = this.load(workspace.id);
      if ((existing?.revision ?? 0) !== baseRevision)
        throw new WorkspaceError(
          "stale-revision",
          "A newer interaction has replaced this run. Reload the saved workspace.",
        );
      this.#db
        .prepare(
          "INSERT INTO workspaces VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,json=excluded.json",
        )
        .run(workspace.id, workspace.revision, JSON.stringify(workspace));
      this.#db
        .prepare(
          "UPDATE requests SET status='complete',response=? WHERE workspace_id=? AND request_id=? AND status='running'",
        )
        .run(JSON.stringify(response), workspace.id, requestId);
      this.#db.exec("COMMIT");
    } catch (error) {
      try {
        this.#db.exec("ROLLBACK");
      } catch {
        /* No transaction may have started. */
      }
      if (error instanceof WorkspaceError) throw error;
      throw new WorkspaceError(
        "persistence-failure",
        "Workspace save failed. The last saved revision is preserved. Correct local storage and retry with a new request ID.",
      );
    }
  }
  close() {
    this.#db.close();
  }
}
