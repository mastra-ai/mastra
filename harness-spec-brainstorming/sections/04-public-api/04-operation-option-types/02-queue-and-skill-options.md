### 4.4b Queue and Skill Options

```ts
// `QueueOptions` deliberately omits `addTools`; §4.3 owns the override rule
// and rationale.
interface QueueOptions extends Omit<HarnessOverrides, 'addTools'> {
  content: string;
  files?: FileAttachment[];
  // Optional caller-supplied idempotency key. When present, `queue(...)`
  // enforces uniqueness under the active session lease and returns the existing
  // queued item/result metadata for exact duplicate admissions. The harness
  // still mints and persists an internal admissionId for every queued item when
  // callers omit this field, because crash recovery must retry the drain
  // admission with a stable key.
  admissionId?: string;
  requestContext?: RequestContextInput;
  tracingContext?: TracingContext;
  tracingOptions?: TracingOptions;
}

// `admissionId` duplicate detection uses a stable admission hash. For
// message/queue inputs, the hash inputs are the normalized content, persisted
// file references or content digests, serializable `requestContext`, and
// relevant serializable turn overrides (`model`, `mode`, `yolo`). For untyped
// skill invocation, the hash also includes the skill name, resolved skill source
// and content digest, validated args, and expanded prompt. Because the hash must
// be reproducible, `admissionId` cannot be combined with non-serializable
// overrides such as `addTools`; `queue(...)` omits `addTools`, and
// signal-driven `message(...)` / untyped `useSkill(...)` reject that combination
// with `HarnessValidationError`. `message({ sync: true, output, admissionId })`
// and `useSkill({ output, admissionId })` are also rejected until a separate
// generate-admission receipt exists. When `admissionId` is present,
// `requestContext` and every hash input must validate against the Harness
// stable-hash canonicalization profile (§5.1); non-serializable values reject
// with `HarnessValidationError` before admission. Exact retries with the same
// `admissionId` and hash return the original metadata while the owning
// operation evidence is retained; a retry with the same `admissionId` and a
// different hash throws `HarnessAdmissionConflictError`. §5.1 and §5.7 own the
// concrete signal evidence, `QueueAdmissionReceipt`, `OperationAdmissionTombstone`,
// retention, post-compaction lookup, and recovery behavior; §15 owns the
// corresponding verification invariants.

interface UseSkillOptions<S extends PublicSchema | undefined = undefined> extends HarnessOverrides {
  args?: Record<string, unknown>;   // injected into the skill prompt
  files?: FileAttachment[];
  output?: S;                       // typed result
  // Optional caller-supplied idempotency key for untyped skill invocations from
  // retrying transports. Valid only when `output` is absent; typed skill output
  // shares the sync-generate path and rejects `admissionId` in v1.
  admissionId?: string;
  requestContext?: RequestContextInput;
  tracingContext?: TracingContext;
  tracingOptions?: TracingOptions;
}

```
