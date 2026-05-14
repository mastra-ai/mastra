### 4.2g Required Agent Resume Boundary

`respondToToolApproval(...)`, `respondToToolSuspension(...)`,
`respondToQuestion(...)`, `respondToPlanApproval(...)`, and retrying channel
actions rely on an internal agent/workflow resume boundary. It is not exposed to
remote clients, but an agent implementation that cannot satisfy it for a
pending-item kind cannot expose durable retry semantics for that kind in Harness
v1.

```ts
interface AgentResumeBoundary {
  supportsResumeAttempt(input: AgentResumeSupportInput): AgentResumeSupport;
  resumeStream(input: AgentResumeInput): Promise<AgentResumeResult>;
  resumeGenerate(input: AgentResumeInput): Promise<AgentResumeResult>;
  getResumeResult?(input: AgentResumeResultLookup): Promise<AgentResumeResult>;
}

interface AgentResumeSupportInput {
  harnessName: string;
  agentId: string;
  runId: string;
  pendingKind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';
  resumeMethod: 'stream' | 'generate';
}

type AgentResumeSupport =
  | { supported: true }
  | { supported: false; reason: 'resume_attempt_id_unsupported' | 'pending_kind_unsupported' | 'resume_method_unsupported' };

interface AgentResumeInput {
  harnessName: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  runId: string;
  pendingKind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';
  itemId: string;
  pendingRequestedAt: number;
  responseId: string;
  responseHash: string;
  resumeAttemptId: string;          // always equal to responseId in v1
  resumeData: JsonValue;
  requestContext?: PersistedRequestContextInput;
}

interface AgentResumeResultLookup {
  harnessName: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  runId: string;
  resumeAttemptId: string;
}

type AgentResumeResult =
  | { status: 'accepted'; runId: string; resumeAttemptId: string; duplicate: boolean }
  | { status: 'applied'; runId: string; resumeAttemptId: string; duplicate: boolean; result: AgentResult }
  | { status: 'failed'; runId: string; resumeAttemptId: string; duplicate: boolean; retryable: boolean; error: { code: string; message: string } };
```

`resumeAttemptId` is the idempotency key for applying a response to a suspended
run. Exact duplicate calls with the same `resumeAttemptId` and `responseHash`
must not resume the workflow twice: they return the original in-flight,
applied, or failed result while retained. A same-`resumeAttemptId` call with a
different response hash is a Harness-level `HarnessInboxResponseConflictError`
before the boundary is called.

The session owner checks `supportsResumeAttempt(...)` for the pending kind and
resume method before clearing the pending field or writing an
`InboxResponseReceipt(status: 'accepted')`. Unsupported kinds fail closed:
retrying external transports, including wire inbox routes and channel
buttons/forms, are disabled or rejected before consuming the pending item.
Recovery that encounters a legacy `accepted` receipt for an unsupported resume
kind terminalizes that receipt and any channel-originated action receipt with an
unsupported-resume error instead of attempting a non-idempotent resume.

The resume method is selected deterministically for both first application and
recovery: the session owner checks `supportsResumeAttempt(...)` for `stream`
and `generate`, prefers `stream` when both are supported, uses `generate` when
only that method is supported, and fails closed when neither is supported.
`resumeAttemptId` idempotency is boundary-wide for the run and response hash;
recovery re-derives the method by the same rule rather than persisting a
separate method field on `InboxResponseReceipt`.

The boundary must distinguish a duplicate already-applied resume from a missing
or expired workflow snapshot. A duplicate accepted/applied attempt returns the
stored status/result by `resumeAttemptId`; a genuinely missing snapshot returns
a terminal or retryable `failed` result according to the agent/workflow layer's
snapshot policy. Harness recovery then updates the `InboxResponseReceipt` under
the owning session lease before exposing the session as idle.
