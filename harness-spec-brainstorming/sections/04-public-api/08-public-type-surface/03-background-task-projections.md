### 4.8c Background Task Projections

```ts
// BackgroundTask is the route-facing diagnostic projection for scoped task
// observation. It is not the storage row and does not expose claim IDs,
// executor/completion policy refs, owner-proof rows, or worker recovery state.
// The diagnostic route may omit or redact args/result/error fields according to
// §13.2; storage row classification and reconstructable worker shape live in
// §5.1, claim helpers in §5.2, and recovery semantics in §5.7.
// Diagnostic status literals mirror the canonical storage row literals at
// §5.1b.2 (`BackgroundTaskRowStatus`); the projection redacts claim/executor/
// completion fields but shares the status taxonomy 1:1. Any change to the
// literal set is a public-API change governed by §11.6.
type BackgroundTaskStatus = BackgroundTaskRowStatus;

interface BackgroundTask {
  id: string;
  status: BackgroundTaskStatus;
  toolName: string;
  toolCallId: string;
  args?: Record<string, JsonValue>;
  agentId: string;
  runId: string;
  threadId?: string;
  resourceId?: string;
  sessionId?: string;
  owningSessionId?: string;
  createdAt: number;
  updatedAt?: number;
  startedAt?: number;
  completedAt?: number;
  attempts?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  nextAttemptAt?: number;
  result?: JsonValue;
  error?: { code?: string; message: string };
}

```
