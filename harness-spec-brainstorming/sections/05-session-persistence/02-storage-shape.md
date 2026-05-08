### 5.2 Storage shape

`MastraStorage` gains a `harness` domain:

```ts
interface MastraStorage {
  // ...existing domains (agents, memory, workflows, ...)...

  harness: {
    // Threads (already specified — moved here under the harness domain)
    // Threads. Like `loadSession`, the direct-ID primitives do NOT enforce
    // resource scoping — the harness layer cross-checks each record's
    // `resourceId` before returning to a caller (see §2.3). `listThreads`
    // takes `resourceId` as part of `ListThreadsOptions` and is expected to
    // filter at the storage layer for efficiency.
    saveThread(record: HarnessThread): Promise<void>;
    loadThread(opts: { threadId: string }): Promise<HarnessThread | null>;
    listThreads(opts: ListThreadsOptions): Promise<HarnessThread[]>;
    deleteThread(opts: { threadId: string }): Promise<void>;

    // Messages
    appendMessages(opts: { threadId: string; messages: HarnessMessage[] }): Promise<void>;
    listMessages(opts: { threadId: string } & ListMessagesOptions): Promise<HarnessMessage[]>;

    // Sessions (new in v1)
    saveSession(
      record: SessionRecord,
      opts: { ownerId: string; ifVersion: number },
    ): Promise<{ version: number }>;

    // Direct ID lookup. Returns the record regardless of `closedAt` — this is
    // the path that powers history APIs and `harness.session({ sessionId })`
    // (which throws `HarnessSessionClosedError` for closed records — see §5.5).
    //
    // This primitive does NOT enforce resource scoping; it returns whatever
    // record matches the ID. The harness layer cross-checks `resourceId`
    // against the returned record before surfacing it to a caller and throws
    // `HarnessSessionNotFoundError` on mismatch (see §2.3). Adapters do not
    // need to implement tenancy themselves.
    loadSession(opts: { sessionId: string }): Promise<SessionRecord | null>;

    // Lookup by (thread, resource). Returns only **active** records, defined
    // as `closedAt === undefined`. Returns `null` when no active record exists,
    // even if one or more closed records match the (threadId, resourceId) pair.
    // This is what makes `harness.session({ threadId, resourceId })` create a
    // fresh session after a previous one was closed (see §5.3).
    // If multiple active records exist for the pair (a degenerate state — the
    // harness never produces this, but operator tooling might), implementations
    // return the most recent by `lastActivityAt`.
    loadSessionByThread(opts: { threadId: string; resourceId: string }): Promise<SessionRecord | null>;

    // Listing. Closed records are excluded by default; pass `includeClosed: true`
    // to surface them for history / audit views.
    listSessions(opts: { resourceId: string; includeClosed?: boolean }): Promise<SessionSummary[]>;

    deleteSession(opts: { sessionId: string }): Promise<void>;

    // Session leases (new in v1) — see §5.8 for the write-concurrency contract.
    acquireSessionLease(opts: {
      sessionId: string;
      ownerId: string;
      ttlMs: number;
    }): Promise<{ version: number; expiresAt: number }>;
    renewSessionLease(opts: {
      sessionId: string;
      ownerId: string;
      ttlMs: number;
    }): Promise<{ version: number; expiresAt: number }>;
    releaseSessionLease(opts: {
      sessionId: string;
      ownerId: string;
    }): Promise<void>;

    // File attachments (new in v1).
    // Inline-form attachments on queued / suspended messages are flushed here
    // before the queue item is persisted, then deleted after the message is
    // consumed. Implementations may back this with a separate blob store.
    saveAttachment(opts: {
      sessionId: string;
      attachmentId: string;
      name: string;
      mimeType: string;
      data: Uint8Array;
    }): Promise<void>;
    loadAttachment(opts: {
      sessionId: string;
      attachmentId: string;
    }): Promise<{ name: string; mimeType: string; data: Uint8Array } | null>;
    deleteAttachment(opts: {
      sessionId: string;
      attachmentId: string;
    }): Promise<void>;
    deleteAttachmentsForSession(opts: { sessionId: string }): Promise<void>;
  };
}
```

Implementations: in-memory (testing), filesystem (TUI), Postgres / SQLite / DurableObjects / Redis (servers). Same plug-in pattern as the rest of `MastraStorage`. Attachment bytes are typically not co-located with row data — adapters are free to delegate to S3 / R2 / local disk under the same interface.
