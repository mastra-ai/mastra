import type { WorkflowRunState } from '../../workflows/types';

/**
 * Snapshot pruning for the internal agent-loop workflows (issue #18647).
 *
 * Agent-loop snapshots are pure resume artifacts: users never query them
 * (tracing owns observability, memory owns the conversation) — they exist only
 * so `resumeStream()` / `approveToolCall()` can restore a suspended run.
 * Without pruning, every persisted snapshot re-serializes the conversation
 * several times over (step payload/prevOutput message arrays, AI SDK
 * `output.steps` request/response history, and a stale `__streamState`
 * retained on completed steps after each resume), so snapshot size scales with
 * thread length × number of historical suspensions.
 *
 * Rules:
 *  - steps in a terminal state never get resumed again: drop their
 *    `suspendPayload`/`suspendOutput`/`resumePayload` and strip heavy
 *    iteration fields from `payload`/`output`.
 *  - non-terminal (suspended/waiting/paused/running) steps keep their
 *    `suspendPayload` **intact** — it is the resume state (`__streamState`,
 *    `__agentId`, tool-approval info, `__workflow_meta` nested-run ids). Their
 *    `payload` still duplicates the conversation, so heavy fields are stripped
 *    from it; resume rebuilds messages from `__streamState.messageList`.
 *  - foreach aggregation entries (`__workflow_meta.foreachOutput`) get the
 *    same per-entry treatment so still-suspended parallel tool calls keep
 *    their resume state (see foreach-suspend-payload.test.ts).
 *  - `context.input` is the loop's initial iteration data (another full
 *    conversation copy): heavy fields are stripped.
 *  - engine routing state (`suspendedPaths`, `waitingPaths`, `activePaths`,
 *    `resumeLabels`, `serializedStepGraph`, `status`, `runId`, timestamps,
 *    request context) is never touched.
 *
 * This must only be registered on the internal agent workflows
 * (agentic-loop/agentic-execution/durable/network). User-authored workflows
 * keep full suspend/resume history in their run record.
 */

const TERMINAL_STEP_STATUSES = new Set(['success', 'failed', 'skipped', 'bailed', 'canceled']);

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Strips the heavy agent-iteration fields from a step payload/output without
 * mutating the original object:
 *  - `messages` (`{ all, user, nonUser }` — full serialized conversation)
 *  - `output.steps` (AI SDK step history with full request/response bodies)
 *  - `metadata.request` / `metadata.response` bodies
 *  - any `__`-prefixed keys (serialized stream/loop state; only the live
 *    suspension's `suspendPayload.__streamState` matters for resume)
 *
 * Small routing/result fields (`output.toolCalls`, `stepResult`, usage, ids)
 * are preserved.
 */
function stripHeavyIterationFields<T>(value: T): T {
  if (!isPlainObject(value)) return value;
  const pruned: Record<string, any> = { ...value };

  delete pruned.messages;
  for (const key of Object.keys(pruned)) {
    if (key.startsWith('__')) delete pruned[key];
  }

  if (isPlainObject(pruned.output)) {
    const output = { ...pruned.output };
    if (Array.isArray(output.steps)) output.steps = [];
    delete output.messages;
    pruned.output = output;
  }

  if (isPlainObject(pruned.metadata)) {
    const metadata = { ...pruned.metadata };
    delete metadata.request;
    delete metadata.response;
    pruned.metadata = metadata;
  }

  return pruned as T;
}

/** Applies the pruning rules to a single serialized step result. */
function pruneStepResult(result: Record<string, any>): Record<string, any> {
  if (!isPlainObject(result) || typeof result.status !== 'string') return result;

  const pruned: Record<string, any> = { ...result };
  pruned.payload = stripHeavyIterationFields(pruned.payload);
  if ('prevOutput' in pruned) pruned.prevOutput = stripHeavyIterationFields(pruned.prevOutput);

  if (TERMINAL_STEP_STATUSES.has(result.status)) {
    // Completed steps are never resumed again — their old suspension state is
    // dead weight that would otherwise be re-persisted on every later
    // suspension of the run.
    delete pruned.suspendPayload;
    delete pruned.suspendOutput;
    delete pruned.resumePayload;
    if ('output' in pruned) pruned.output = stripHeavyIterationFields(pruned.output);
    return pruned;
  }

  // Non-terminal: a re-suspended step can still carry the previous completed
  // iteration's `output` (the step-result merge spreads the old result) —
  // strip its heavy fields too. Foreach iteration-result arrays are untouched
  // (stripHeavyIterationFields only rewrites plain objects).
  if ('output' in pruned) pruned.output = stripHeavyIterationFields(pruned.output);

  // `suspendPayload` is the resume state — keep it intact, except foreach
  // aggregation entries which get the same per-entry rules (completed
  // iterations stripped, still-suspended ones preserved).
  if (isPlainObject(pruned.suspendPayload)) {
    const meta = pruned.suspendPayload.__workflow_meta;
    if (isPlainObject(meta) && isPlainObject(meta.foreachOutput)) {
      const foreachOutput: Record<string, any> = {};
      for (const [index, entry] of Object.entries(meta.foreachOutput)) {
        foreachOutput[index] = pruneStepResult(entry as Record<string, any>);
      }
      pruned.suspendPayload = {
        ...pruned.suspendPayload,
        __workflow_meta: { ...meta, foreachOutput },
      };
    }
  }

  return pruned;
}

/** Drops the heavy `__streamState` from a suspend payload, keeping routing
 * (`__workflow_meta`) and tool-approval fields. Also applied to foreach
 * aggregation entries nested inside it. */
function stripStreamState(suspendPayload: unknown): unknown {
  if (!isPlainObject(suspendPayload)) return suspendPayload;
  const pruned = { ...suspendPayload };
  delete pruned.__streamState;
  const meta = pruned.__workflow_meta;
  if (isPlainObject(meta) && isPlainObject(meta.foreachOutput)) {
    const foreachOutput: Record<string, any> = {};
    for (const [index, entry] of Object.entries(meta.foreachOutput)) {
      foreachOutput[index] =
        isPlainObject(entry) && 'suspendPayload' in entry
          ? { ...entry, suspendPayload: stripStreamState(entry.suspendPayload) }
          : entry;
    }
    pruned.__workflow_meta = { ...meta, foreachOutput };
  }
  return pruned;
}

/**
 * `snapshot.result` on a suspended run is a status mirror of the suspended
 * step's result (the evented engine persists `prevResult` there). Resume reads
 * the authoritative copy from `snapshot.context`, so the mirror keeps its
 * routing/approval fields but not more `__streamState` conversation copies.
 */
function pruneResultMirror(result: Record<string, any>): Record<string, any> {
  const pruned = pruneStepResult(result);
  if ('suspendPayload' in pruned) pruned.suspendPayload = stripStreamState(pruned.suspendPayload);
  if (Array.isArray(pruned.output)) {
    pruned.output = pruned.output.map((entry: unknown) =>
      isPlainObject(entry) && typeof entry.status === 'string' && 'suspendPayload' in entry
        ? { ...entry, suspendPayload: stripStreamState(entry.suspendPayload) }
        : entry,
    );
  }
  return pruned;
}

/**
 * `pruneSnapshot` hook for the internal agent workflows. Reduces a persisted
 * run snapshot to what resume actually reads: the suspended step's
 * `suspendPayload` (one live `__streamState` copy) plus engine routing state.
 * Copy-on-write — never mutates the snapshot it is given.
 */
export function pruneAgentLoopSnapshot({ snapshot }: { snapshot: WorkflowRunState }): WorkflowRunState {
  const context: WorkflowRunState['context'] = {} as WorkflowRunState['context'];
  for (const [key, value] of Object.entries(snapshot.context ?? {})) {
    if (key === 'input') {
      context.input = stripHeavyIterationFields(value ?? undefined) as Record<string, any> | undefined;
    } else {
      context[key] = pruneStepResult(value as Record<string, any>) as any;
    }
  }

  const result =
    isPlainObject(snapshot.result) && typeof snapshot.result.status === 'string'
      ? pruneResultMirror(snapshot.result)
      : snapshot.result;

  return { ...snapshot, context, result };
}
