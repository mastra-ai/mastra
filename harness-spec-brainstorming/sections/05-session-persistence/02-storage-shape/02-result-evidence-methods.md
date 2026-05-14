### 5.2b Result Evidence Methods

```ts
    // Result operations (receipts / tombstones). These are storage-level
    // evidence helpers, not public wire DTO constructors: §5.1 owns persisted
    // record shapes, §13.3 owns result response envelopes, and §15 verifies the
    // behavior. The bound Harness namespace is still part of every lookup key.
    // The harness layer supplies `resourceId` / `threadId` from the verified
    // session before calling these helpers and tenant-checks returned records.
    //
    // Full retained evidence always wins over a compact tombstone. A tombstone
    // means full result/receipt evidence has already been compacted or a
    // terminal failure was recorded by recovery/lifecycle cleanup; it must not
    // make a still-retained completed/failed result look `expired`.
    loadMessageResultEvidence(opts: {
      sessionId: string;
      resourceId: string;
      threadId: string;
      signalId: string;
    }): Promise<AgentSignalResultStatus | OperationAdmissionTombstone | null>;

    loadQueueResultEvidence(opts: {
      sessionId: string;
      resourceId: string;
      queuedItemId: string;
    }): Promise<QueueAdmissionReceipt | OperationAdmissionTombstone | null>;

    // Resolves retained duplicate-admission evidence for signal-driven
    // messages / untyped skills and queued items. It checks retained signal
    // result evidence, retained queue receipts, and compact tombstones for the
    // same `(sessionId, kind, admissionId)` inside the bound Harness namespace.
    // `attemptedAdmissionHash` is compared with the stored hash so exact
    // duplicates can return original admission metadata while same-key /
    // different-hash retries surface `HarnessAdmissionConflictError`.
    resolveOperationAdmissionEvidence(opts: {
      sessionId: string;
      resourceId: string;
      kind: 'message' | 'queue';
      admissionId: string;
      attemptedAdmissionHash: string;
    }): Promise<{
      status: 'none' | 'duplicate' | 'conflict';
      evidence?: AgentSignalAccepted | AgentSignalResultStatus | QueueAdmissionReceipt | OperationAdmissionTombstone;
      storedAdmissionHash?: string;
    }>;

    // Writes the compact identity/hash index used after full result evidence is
    // no longer retained or when recovery/lifecycle terminalization records an
    // unrecoverable operation. This is not a blind overwrite: exact duplicate
    // writes of the same identity/hash are idempotent, while same lookup key
    // with different identity/hash material is storage corruption or admission
    // conflict according to the caller path.
    writeOperationAdmissionTombstone(record: OperationAdmissionTombstone): Promise<void>;

    // Compacts terminal full evidence into an `OperationAdmissionTombstone` and
    // removes or hides the full payload/result evidence in the same
    // storage-linearized operation. Queue receipt compaction that mutates
    // `SessionRecord.queueAdmissionReceipts` must still satisfy the session
    // lease/version rule from `saveSession(...)` or an equivalent internal
    // conditional mutation. Returns `null` when the evidence is missing, already
    // compacted, not terminal, or still inside the full-evidence retention
    // window.
    compactOperationResultEvidence(opts: {
      sessionId: string;
      resourceId: string;
      kind: 'message' | 'queue';
      // Exactly one public result key must be present: `signalId` for message /
      // untyped-skill evidence, or `queuedItemId` for queue evidence.
      signalId?: string;
      queuedItemId?: string;
      now: number;
    }): Promise<OperationAdmissionTombstone | null>;

    // Called by the §5.5 delete cascade before the SessionRecord is physically
    // removed or hidden. Idempotent: after this succeeds, result/admission
    // lookup for the deleted session uses tenant-safe not-found rather than
    // `expired`.
    deleteOperationAdmissionTombstonesForSession(opts: {
      sessionId: string;
      resourceId: string;
    }): Promise<void>;

```
