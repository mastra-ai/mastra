### 5.2d Background, Lease, and Attachment Methods

```ts
    // Reconstructable background-task rows are internal execution machinery,
    // not public admission ledgers. These primitives are required only when the
    // task row itself is used as restart-safe worker state instead of sitting
    // behind an owning source-specific Harness row. They operate only on §5.1
    // `ClaimableBackgroundTaskRow` rows with
    // `durability: 'reconstructable'`, stable executor/completion refs, direct
    // Harness owner fields, retry/due state, and storage claim fields.
    // Diagnostic rows, including rows with `ownerRef`, are excluded because the
    // owning source-specific row remains the recovery boundary. Claims use
    // storage-authoritative time and terminal updates are compare-and-set by
    // the matching claim.
    claimBackgroundTasks(opts: {
      harnessName: string;
      statuses: Array<'pending' | 'failed' | 'running'>;
      claimId: string;
      limit: number;
      now: number;
      claimTtlMs: number;
    }): Promise<ClaimableBackgroundTaskRow[]>;
    renewBackgroundTaskClaim(opts: {
      taskId: string;
      claimId: string;
      now: number;
      claimTtlMs: number;
    }): Promise<{ claimExpiresAt: number; storageNow: number }>;
    updateBackgroundTaskClaim(record: ClaimableBackgroundTaskRow, opts: { claimId: string }): Promise<void>;

    // The claim/renew/CAS methods above are new v1 storage primitives with
    // no counterpart in current `BackgroundTasksStorage`
    // (`../packages/core/src/storage/domains/background-tasks/base.ts:20-54`).
    // Current background-task dispatch in
    // `../packages/core/src/background-tasks/manager.ts` uses pubsub
    // consumer-group routing over in-memory `TaskContext` closures; storage
    // contains no `claim*` API. Reconstructable rows need these primitives
    // so the worker can re-claim due/expired/failed work after restart
    // without depending on the live closure cache. See §5.1b.2 for the
    // three v1-only field families that extend the row.

    // Session leases (new in v1) — see §5.8 for the write-concurrency contract.
    // The session row inside the bound Harness namespace is the lease record.
    // Lease acquisition and renewal must distinguish locked/stale-owner,
    // missing, closed, and corrupt records from transient storage failure so
    // the resolver and live owner can apply §5.3/§5.8: direct-ID closed records
    // fail closed, thread/resource closed-before-acquire races re-run active
    // create-or-load once, duplicate active owners fail as corruption, and
    // failed renewal fences the in-memory owner before any further mutation.
    acquireSessionLease(opts: {
      sessionId: string;
      ownerId: string;
      ttlMs: number;
    }): Promise<{ version: number; expiresAt: number; storageNow: number }>;
    renewSessionLease(opts: {
      sessionId: string;
      ownerId: string;
      ttlMs: number;
    }): Promise<{ version: number; expiresAt: number; storageNow: number }>;
    renewSessionLeaseSubtree(opts: {
      rootSessionId: string;
      ownerId: string;
      ttlMs: number;
    }): Promise<{
      version: number;
      expiresAt: number;
      storageNow: number;
      renewedDescendantCount: number;
    }>;
    releaseSessionLease(opts: {
      sessionId: string;
      ownerId: string;
    }): Promise<void>;
    // Release clears only a matching current owner. If the lease has already
    // moved or expired, release must not clear another owner's lease; the
    // caller treats it as stale cleanup and only drops local resources.

    // File attachments (new in v1).
    // Inline, pre-uploaded, URL-ingested, and provider-ingested inputs are
    // stored here before any durable record references them. Implementations
    // may back this with a separate blob/object store, but the harness storage
    // contract still owns harness/session scoping, digest metadata, and guarded
    // deletion. Attachment metadata is keyed by `(harnessName, ownerSessionId,
    // attachmentId)`. The `sessionId` parameter on these methods names that
    // owning session; the storage view is already bound to one Harness
    // namespace, and `PersistedAttachment.ownerSessionId` records the same
    // owner for durable refs that can outlive the active session that reads
    // them.
    saveAttachment(opts: {
      sessionId: string;
      attachmentId: string;
      name: string;
      mimeType: string;
      data: Uint8Array;
      source: 'inline' | 'preupload' | 'url' | 'provider';
    }): Promise<{ attachmentId: string; bytes: number; sha256: string }>;
    loadAttachment(opts: {
      sessionId: string;
      attachmentId: string;
    }): Promise<{ name: string; mimeType: string; bytes: number; sha256: string; data: Uint8Array } | null>;
    listAttachmentReferences(opts: {
      sessionId: string;
      attachmentId: string;
    }): Promise<Array<{
      source:
        | 'queued_item'
        | 'queue_receipt'
        | 'current_run'
        | 'message_history'
        | 'channel_inbox'
        | 'wakeup'
        | 'outbox';
      sourceId: string;
      retainedUntil?: number;
    }>>;
    deleteAttachment(opts: {
      sessionId: string;
      attachmentId: string;
    }): Promise<void>;
    deleteAttachmentsForSession(opts: { sessionId: string }): Promise<void>;
}
```
