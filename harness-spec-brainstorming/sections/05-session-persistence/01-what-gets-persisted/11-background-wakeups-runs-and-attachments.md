### 5.1e Background, Wakeup, Run, and Attachment Records

Orientation diagram (lifecycle and ownership only; the TypeScript shapes below
remain authoritative for state names, transitions, and field detail):

<figure>
  <svg role="img" aria-labelledby="hx-bg-wakeup-run-title hx-bg-wakeup-run-desc" viewBox="0 0 1040 560" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-bg-wakeup-run-title">Run, wakeup, and attachment lifecycle map</title>
    <desc id="hx-bg-wakeup-run-desc">HarnessRunOperationalState moves through starting, running, waiting, resuming, and terminal completed/failed/interrupted. HarnessWakeupItem moves through due, claimed, queued or terminal skipped/failed/dead. Persisted attachments anchor durable inputs by stable ref.</desc>
    <defs>
      <marker id="ah-bg-wakeup-run" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="240" y="30" text-anchor="middle">HarnessRunOperationalState.status</text>
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="780" y="30" text-anchor="middle">HarnessWakeupItem.status</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.2; rx: 14;" x="40" y="56" width="170" height="60" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="125" y="92" text-anchor="middle">starting</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.2; rx: 14;" x="40" y="140" width="170" height="60" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="125" y="176" text-anchor="middle">running</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2.2; rx: 14;" x="270" y="140" width="170" height="60" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="355" y="176" text-anchor="middle">waiting</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2.2; rx: 14;" x="270" y="224" width="170" height="60" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="355" y="260" text-anchor="middle">resuming</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2.2; rx: 14;" x="40" y="308" width="120" height="56" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="100" y="341" text-anchor="middle">completed</text>

    <rect style="fill: #fef2f2; stroke: #ef4444; stroke-width: 2.2; rx: 14;" x="180" y="308" width="120" height="56" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="240" y="341" text-anchor="middle">failed</text>

    <rect style="fill: #fef2f2; stroke: #ef4444; stroke-width: 2.2; rx: 14;" x="320" y="308" width="130" height="56" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="385" y="341" text-anchor="middle">interrupted</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-bg-wakeup-run);" d="M125 116 L125 139" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-bg-wakeup-run);" d="M210 170 L269 170" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-bg-wakeup-run);" d="M355 200 L355 223" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-bg-wakeup-run);" d="M270 254 L210 200" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-bg-wakeup-run);" d="M120 200 L100 308" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-bg-wakeup-run);" d="M150 200 L240 308" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-bg-wakeup-run);" d="M200 200 L380 308" />

    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="135" y="132">commit</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="225" y="160">pending item</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="365" y="218">response</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2.2; rx: 14;" x="600" y="56" width="170" height="60" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="685" y="92" text-anchor="middle">due</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2.2; rx: 14;" x="600" y="140" width="170" height="60" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="685" y="176" text-anchor="middle">claimed</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2.2; rx: 14;" x="830" y="140" width="160" height="60" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="910" y="176" text-anchor="middle">queued</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="830" y="224" width="160" height="56" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="910" y="257" text-anchor="middle">skipped</text>

    <rect style="fill: #fef2f2; stroke: #ef4444; stroke-width: 2.2; rx: 14;" x="600" y="232" width="170" height="56" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="685" y="265" text-anchor="middle">failed (retryable)</text>

    <rect style="fill: #fef2f2; stroke: #ef4444; stroke-width: 2.2; rx: 14;" x="600" y="308" width="170" height="56" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="685" y="341" text-anchor="middle">dead</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-bg-wakeup-run);" d="M685 116 L685 139" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-bg-wakeup-run);" d="M770 170 L829 170" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-bg-wakeup-run);" d="M770 195 L830 240" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-bg-wakeup-run);" d="M685 200 L685 231" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-bg-wakeup-run);" d="M685 288 L685 307" />
    <path style="stroke: #94a3b8; stroke-width: 1.8; fill: none; stroke-dasharray: 6 6; marker-end: url(#ah-bg-wakeup-run);" d="M620 232 L620 200" />

    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="700" y="132">claim under TTL</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="780" y="162">admit to session</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="780" y="222">policy skip</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="695" y="225">transient</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="557" y="218">renew</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="700" y="304">attempts exhausted</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="40" y="412" width="950" height="76" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="515" y="441" text-anchor="middle">PersistedAttachment (stable ref + bytes/digest)</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="515" y="464" text-anchor="middle">referenced by queued items, channel inbox items, wakeup items, and run snapshots — never raw URLs or file handles</text>

    <path style="stroke: #94a3b8; stroke-width: 1.8; fill: none; stroke-dasharray: 5 5; marker-end: url(#ah-bg-wakeup-run);" d="M240 364 L240 411" />
    <path style="stroke: #94a3b8; stroke-width: 1.8; fill: none; stroke-dasharray: 5 5; marker-end: url(#ah-bg-wakeup-run);" d="M685 200 C685 380 685 405 685 411" />

    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="40" y="528">Background task rows: reconstructable rows persist trusted owner + executor/policy refs; closure-backed diagnostic rows fail closed after restart and surface through the owning Harness row.</text>
  </svg>
  <figcaption>Run and wakeup rows have separate state machines; persisted attachments anchor durable inputs across all admission row families; background-task rows that lack reconstructable refs remain diagnostic only.</figcaption>
</figure>

```ts
// Background task-backed autonomous work follows the same serialization rule.
// A persisted task row can be the durable boundary only if it carries stable
// references and serialized metadata sufficient to rebuild both the executor
// and completion policy after restart. It must not rely on `TaskContext`
// closures, live stream controllers, in-memory message lists, save-queue
// instances, SDK thread handles, webhook request/response objects, or other
// process-local state. If those live objects are required, the durable source is
// the owning `QueuedItem`, channel inbox/action/outbox row, or explicit
// wakeup/work row; the background task is only an internal worker for that
// durable source.
// When a background task row is itself the reconstructable worker handle, it
// must use the §5.1 `BackgroundTaskReconstructableRow` shape: direct trusted
// owner fields, a stable executor reference, a stable completion-policy
// reference, §9 registry-resolvable ids and generations, the runtime/executor
// compatibility generation, retry/attempt state, and storage claim fields.
// Closure-backed `TaskContext` rows without that metadata are
// `BackgroundTaskDiagnosticRow` rows; after restart they fail closed or leave
// the owning Harness row named by `ownerRef`
// retryable/dead-lettered for repair.

// Durable scheduled/proactive work uses explicit wakeup rows. These rows are the
// recovery boundary between an external scheduler/clock and Harness session
// admission. They are intentionally not SessionRecord fields because workers
// must scan and claim due work without first becoming a session owner.
interface HarnessWakeupItem {
  id: string;
  harnessName: string;
  source: 'schedule' | 'proactive';
  sourceId: string;                    // schedule id, product job id, or other stable source key
  fireId: string;                      // stable occurrence id from the source
  idempotencyKey: string;              // unique for this wakeup's session admission
  payloadHash: string;                 // hash of normalized admission payload
  admissionId: string;                 // passed to queue(...) for de-dupe
  status: 'due' | 'claimed' | 'queued' | 'skipped' | 'failed' | 'dead';
  scheduledFor: number;
  dueAt: number;
  missedCount?: number;                // coalesced missed fires represented by this row
  // Present only for scheduled/proactive work that is binding-backed channel
  // delivery. Before queue admission, the worker validates this active binding
  // and generation, then builds `requestContext.channel` from the binding's
  // durable target identifiers. If no active binding exists, the wakeup is
  // either non-channel work without `requestContext.channel` or terminal/retry
  // work under its own failure policy; it must not persist fake platform IDs.
  harnessChannel?: {
    channelId: string;
    providerId: string;
    bindingId: string;
    bindingGeneration: number;
  };
  resourceId?: string;
  threadId?: string;
  sessionId?: string;
  queuedItemId?: string;
  requestContext: PersistedRequestContextInput;
  content: string;
  attachments: PersistedAttachment[];
  mode?: string;
  model?: string;
  attempts: number;
  claimId?: string;
  claimExpiresAt?: number;
  nextAttemptAt?: number;
  createdAt: number;
  updatedAt: number;
  lastError?: { code: HarnessRowErrorCode; message: string; retryable?: boolean };
}

type HarnessRunStatus =
  | 'starting'
  | 'running'
  | 'waiting'
  | 'resuming'
  | 'completed'
  | 'failed'
  | 'interrupted';

type HarnessRunOperationRef =
  | {
      kind: 'message';
      admissionId?: string;
      admissionHash?: string;
      signalId?: string;
      channelInboxItemId?: string;
    }
  | {
      kind: 'queue';
      queuedItemId: string;
      admissionId?: string;
      admissionHash?: string;
      signalId?: string;
      channelInboxItemId?: string;
    }
  | {
      kind: 'sync-generate';
      operationId: string;
    }
  | {
      kind: 'use-skill';
      skillName: string;
      admissionId?: string;
      admissionHash?: string;
      signalId?: string;
    }
  | {
      kind: 'inbox-response';
      itemId: string;
      responseId: string;
      actionReceiptId?: string;
      resumeAttemptId: string;
    };

interface HarnessRunOperationalState {
  runId: string;
  // Mirrors the owning SessionRecord namespace for projection/audit. A mismatch
  // with the containing SessionRecord is corrupt state, not a retargeting hint.
  harnessName: string;
  traceId?: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  // Stable runtime identities needed to rehydrate or fail closed after restart.
  // These are registry/config IDs, not live closures or client objects.
  agentId: string;                  // Resolved from the effective mode's
                                    //   `HarnessMode.agentId` at run start and
                                    //   persisted with `modeId` / `modelId`
                                    //   before the agent is called.
  // Persisted tool identities prove only stable registry/config entries. Tool
  // names, schemas, metadata-only snapshots, live toolset objects, client tool
  // callbacks, or same-named fallback tools are not enough to rehydrate a
  // committed run surface.
  toolIds?: string[];
  // Stable MCP binding/server identities used by the run. These are registry
  // and config IDs only: they are not recoverable MCP transport sessions,
  // connection-status records, resource subscriptions, elicitation handlers,
  // progress callbacks, source-specific callback ledgers, or a public
  // per-binding status inventory.
  mcpBindingIds?: string[];
  workspaceProviderId?: string;
  // Snapshot of `HarnessConfig.runtimeCompatibilityGeneration` at run start.
  // When present on a non-terminal `currentRun`, hydration requires the
  // current config's generation to match exactly. A mismatch means the
  // runtime dependency surface has drifted and the harness fails closed
  // rather than resuming with potentially incompatible semantics. Absence
  // on a legacy run means no generation guard was set at run start and
  // hydration falls back to ID-only validation.
  runtimeCompatibilityGeneration?: string;
  // Set to `true` during the synchronous run-start transition (§5.7) when
  // the entry-point overrides included `addTools` — i.e. `message({ addTools })`
  // (signal-driven, `stream`, or `sync: true, output` forms) or
  // `useSkill({ addTools })` — or when a compatibility path admits any other
  // per-run executable tool surface that cannot be reconstructed from stable
  // persisted tool identities. The added tool implementations are process-local
  // closures that never persist, so this boolean is the durable signal that
  // the run's tool surface cannot be reconstructed after restart or registry
  // loss. On hydration the harness fails closed for any non-terminal run
  // carrying this flag — see §5.7 and §6.2. The flag is per-run; subagent runs
  // do not inherit a parent's value because subagent invocation is a tool call,
  // not an entry-point operation that accepts `addTools`.
  nonRehydratableToolSurface?: boolean;
  requestContext?: PersistedRequestContextInput;
  operation: HarnessRunOperationRef;
  modeId: string;
  modelId: string;
  yolo?: boolean;
  // Pending item ids are duplicated here only for quick inspection after
  // hydration. The authoritative pending item payloads remain the typed
  // `pendingApproval` / `pendingSuspension` / `pendingQuestion` /
  // `pendingPlan` fields below. Hydration rebuilds this array from those
  // canonical fields; extra, missing, or wrong-kind stored entries do not
  // authorize a pending item.
  pendingItems?: Array<{
    itemId: string;
    kind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';
    requestedAt: number;
  }>;
  status: HarnessRunStatus;
  startedAt: number;
  updatedAt: number;
  terminalAt?: number;
  finishReason?: string;
  error?: { code: HarnessRowErrorCode; message: string };
}

type PersistedAttachment = {
  kind: 'ref';
  name: string;
  mimeType: string;
  ownerSessionId: string;
  attachmentId: string;
  bytes: number;
  sha256: string;
  source: 'inline' | 'preupload' | 'url' | 'provider';
};

Raw URLs, process-local file paths, provider temporary URLs, and live file
handles are never `PersistedAttachment` values. Any operation that writes a
durable queue item, channel inbox item, wakeup item, accepted-signal/thread
input, or current-run snapshot first stores the bytes as a Harness-owned
attachment and persists this stable ref plus size/digest metadata. URL-form
`FileAttachment` inputs are fetched/copied before the durable write or the
operation rejects before admission. Attachment IDs are not reused for different
bytes within an owning session; a same-owner same-ID/different-digest save is a
storage conflict, not an overwrite. `ownerSessionId` is the session whose
attachment storage record owns the bytes. For ordinary admissions it equals the
active session. Cloned message history preserves the original `ownerSessionId`,
`attachmentId`, and `sha256` so the historical ref stays resolvable without
turning it into a staged or live input for the clone's session.

interface PersistedRequestContextInput {
  app?: Record<string, JsonValue>;
  // Trusted integration-created slot only. Direct caller input never persists a
  // top-level `channel` key; the channel bridge, scheduled/proactive channel
  // work, or another harness-owned integration reconstructs it from durable
  // provider/binding evidence before admission.
  channel?: ChannelRequestContext;
}

`PersistedRequestContextInput` is not the agent runtime `RequestContext` map.
Runtime-only slots such as `harness`, `MastraMemory`, `browser`, raw auth/user
objects, `userPermissions`, `userRoles`, `mastra__*` keys, `__mastra*` workflow
or agent control markers, SDK clients, abort signals, workspace handles, and
functions are never persisted. They are rebuilt by the Harness, Mastra Server,
agent, memory, workflow, or browser layer for the active execution after the
durable `app` and trusted `channel` fields have been validated.

§4.4 owns request-context source precedence. This section owns the durable
subset: storage rows, admission hashes, response hashes, read models, activity
projections, and client-facing diagnostics operate on normalized
`PersistedRequestContextInput` or their own normalized response DTOs, never on
the full runtime `RequestContext` map after runtime-only slots have been
attached. Implementations must construct persisted request context through the
explicit `PersistedRequestContextInput` allowlist before runtime slots are
attached, or through an equivalent strip step that removes every runtime-only
slot; they must not call generic `RequestContext.toJSON()` after attaching
`harness` or other live slots and persist the partially serialized result.

```
