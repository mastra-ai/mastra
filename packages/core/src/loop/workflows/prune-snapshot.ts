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
 *    iteration fields from `payload`/`output` — except the AI SDK step
 *    history (`output.output.steps`), which the evented engine re-reads as
 *    `inputData` for the next LLM execution when a sibling step resumes in
 *    the same run. A terminal `payload` additionally loses the durable
 *    loop's threaded iteration state (`messageListState`, `accumulatedSteps`,
 *    `lastStepResult`) — see `stripTerminalPayloadState`.
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
 *  - on a **`running`** snapshot only, completed steps additionally give up
 *    `messageListState` / `accumulatedSteps` (issue #20747 — see
 *    `pruneRunningHistory`).
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

function mapForeachOutput(
  foreachOutput: unknown,
  mapEntry: (entry: unknown) => unknown,
): Record<string, unknown> | unknown[] | undefined {
  if (Array.isArray(foreachOutput)) return foreachOutput.map(mapEntry);
  if (!isPlainObject(foreachOutput)) return undefined;
  return Object.fromEntries(Object.entries(foreachOutput).map(([index, entry]) => [index, mapEntry(entry)]));
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

/**
 * Lighter strip for a **terminal** step's `output`. On an evented same-run
 * resume the engine rehydrates the loop from the snapshot, and the next LLM
 * execution re-reads the last completed iteration's `output.steps` (step
 * number, stopWhen input, processor step history) — resetting it to `[]`
 * changes the next model request and breaks resume. Everything else follows
 * the normal heavy-field rules (`messages`, `__` keys, request/response
 * bodies).
 */
function stripTerminalOutputFields<T>(value: T): T {
  if (!isPlainObject(value)) return value;
  const pruned: Record<string, any> = { ...value };

  delete pruned.messages;
  for (const key of Object.keys(pruned)) {
    if (key.startsWith('__')) delete pruned[key];
  }

  if (isPlainObject(pruned.output)) {
    const output = { ...pruned.output };
    delete output.messages;
    // The step history has to survive (resume re-reads it), but each entry
    // carries the request that produced it, whose body is the tool schemas plus
    // the system instruction — invariant across the run and re-serialized in
    // full for every step. That is what pushed a single suspended run past
    // MongoDB's 16 MB document limit. Resume only reads step number, stopWhen
    // input and processor history from these entries, and the sibling
    // `metadata.request` is already dropped above, so the body goes too.
    if (Array.isArray(output.steps)) {
      output.steps = output.steps.map((step: unknown) => {
        if (!isPlainObject(step) || !isPlainObject(step.request) || !('body' in step.request)) return step;
        const { body: _body, ...request } = step.request;
        return { ...step, request };
      });
    }
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

/**
 * Drops `stepResult.request`: the raw provider request the engine echoes back
 * into the iteration state, carrying the full serialized prompt and the entire
 * tool JSON schema on BOTH sides of every step result, rewritten at every step
 * boundary. Nothing reads it back (there are zero `stepResult.request` reads
 * in the codebase) and resume rebuilds the next request from
 * `messageListState`, never from this echo. The sibling `metadata.request` is
 * already deleted unconditionally for exactly this reason; `stepResult` itself
 * stays because core documents it as a preserved routing field, but `request`
 * is the one member of it that carries no routing. Measured over 300 real
 * production snapshots it was 86.7 MB of 360.7 MB persisted, 24% of
 * everything written.
 */
function stripStepResultRequest<T>(value: T): T {
  if (!isPlainObject(value) || !isPlainObject(value.stepResult)) return value;
  if (!('request' in value.stepResult)) return value;
  const { request: _request, ...stepResult } = value.stepResult;
  return { ...value, stepResult } as T;
}

/**
 * Iteration state the durable agent loop threads through every step as that
 * step's *input*: the full serialized conversation, every step record so far,
 * and the previous step result. A step's `payload` is the input it was called
 * with, so each completed iteration pins another conversation-sized copy that
 * the evented engine re-persists at every later step boundary.
 *
 * A terminal step is never re-invoked, so its copy has no reader left:
 *  - resume feeds forward the **suspended** step's payload
 *    (`workflows/evented/execution-engine.ts` reads
 *    `stepResults[getStepId(resumePath)]?.payload`), and suspended steps are
 *    non-terminal, so this strip never touches them;
 *  - a same-run continuation reads the last completed iteration's `output`,
 *    which `stripTerminalOutputFields` deliberately keeps;
 *  - recovery rebuilds the conversation from `snapshot.context.input`.
 * All three are left intact.
 */
const DEAD_TERMINAL_PAYLOAD_FIELDS = ['messageListState', 'accumulatedSteps', 'lastStepResult'] as const;

function stripTerminalPayloadState<T>(value: T): T {
  if (!isPlainObject(value)) return value;
  if (!DEAD_TERMINAL_PAYLOAD_FIELDS.some(field => field in value)) return value;
  const pruned: Record<string, any> = { ...value };
  for (const field of DEAD_TERMINAL_PAYLOAD_FIELDS) delete pruned[field];
  return pruned as T;
}

/** Applies the pruning rules to a single serialized step result. */
function pruneStepResult(
  result: Record<string, any>,
  { preserveTerminalPayloadState = false }: { preserveTerminalPayloadState?: boolean } = {},
): Record<string, any> {
  if (!isPlainObject(result) || typeof result.status !== 'string') return result;

  const pruned: Record<string, any> = { ...result };
  pruned.payload = stripStepResultRequest(pruned.payload);
  if ('output' in pruned) pruned.output = stripStepResultRequest(pruned.output);
  pruned.payload = stripHeavyIterationFields(pruned.payload);
  if ('prevOutput' in pruned) pruned.prevOutput = stripHeavyIterationFields(pruned.prevOutput);

  if (TERMINAL_STEP_STATUSES.has(result.status)) {
    // Completed steps are never resumed again — their old suspension state is
    // dead weight that would otherwise be re-persisted on every later
    // suspension of the run.
    delete pruned.suspendPayload;
    delete pruned.suspendOutput;
    delete pruned.resumePayload;
    if (!preserveTerminalPayloadState) pruned.payload = stripTerminalPayloadState(pruned.payload);
    if ('output' in pruned) pruned.output = stripTerminalOutputFields(pruned.output);
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
    if (isPlainObject(meta)) {
      const foreachOutput = mapForeachOutput(meta.foreachOutput, entry =>
        pruneStepResult(entry as Record<string, any>),
      );
      if (foreachOutput) {
        pruned.suspendPayload = {
          ...pruned.suspendPayload,
          __workflow_meta: { ...meta, foreachOutput },
        };
      }
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
  if (isPlainObject(meta)) {
    const foreachOutput = mapForeachOutput(meta.foreachOutput, entry =>
      isPlainObject(entry) && 'suspendPayload' in entry
        ? { ...entry, suspendPayload: stripStreamState(entry.suspendPayload) }
        : entry,
    );
    if (foreachOutput) pruned.__workflow_meta = { ...meta, foreachOutput };
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
 * Per-step fields that carry the accumulated conversation forward through the
 * durable loop. `messageListState` is the serialized message list;
 * `accumulatedSteps` is the running step history. Both grow with the run.
 */
const RUNNING_HISTORY_FIELDS = ['messageListState', 'accumulatedSteps'] as const;

function stripRunningHistoryFields<T>(value: T): T {
  if (!isPlainObject(value)) return value;

  const present = RUNNING_HISTORY_FIELDS.filter(key => key in value);
  // The mapping steps wrap the same state one level down under `llmOutput`,
  // so a top-level-only strip would leave those copies behind.
  const nested = isPlainObject(value.llmOutput) && RUNNING_HISTORY_FIELDS.some(key => key in value.llmOutput);
  if (present.length === 0 && !nested) return value;

  const pruned: Record<string, any> = { ...value };
  for (const key of present) delete pruned[key];
  if (nested) pruned.llmOutput = stripRunningHistoryFields(pruned.llmOutput);
  return pruned as T;
}

/**
 * Extra pruning applied **only** to `running` snapshots (issue #20747).
 *
 * The durable agent loop persists `running` on every step so
 * `recoverActiveRuns()` can find in-flight runs after a crash (issue #19056).
 * Unlike a suspended snapshot, a running one is not a resume artifact — it is a
 * liveness marker that recovery re-drives via `restart()`. But it is written
 * once per step and, because the snapshot is cumulative, each write
 * re-serialized every completed step's `messageListState` and
 * `accumulatedSteps` on both the payload and the output side. That is ~20
 * copies of the conversation per write, times one write per step: the O(N^2)
 * curve behind 135 MB on disk for a 57-step run.
 *
 * Live execution never reads historical copies back. Recovery does need the
 * active step's payload, including after that step has reached a terminal state
 * but before the next step starts, because `restart()` uses it as `prevResult`.
 * Keep that one active-path copy and remove conversation state from every older
 * terminal step, bounding duplication independently of run length.
 *
 * Suspended/paused snapshots are untouched — they are the resume path and keep
 * exactly the bytes they keep today.
 */
function getActiveStepIds(snapshot: WorkflowRunState): Set<string> {
  return new Set(
    Object.entries(snapshot.activeStepsPath ?? {})
      .filter(
        ([, path]) =>
          path.length === snapshot.activePaths?.length &&
          path.every((segment, index) => segment === snapshot.activePaths[index]),
      )
      .map(([stepId]) => stepId),
  );
}

function pruneRunningHistory(context: WorkflowRunState['context'], activeStepIds: ReadonlySet<string>): void {
  for (const [key, value] of Object.entries(context ?? {})) {
    if (key === 'input' || activeStepIds.has(key) || !isPlainObject(value)) continue;
    if (!TERMINAL_STEP_STATUSES.has((value as any).status)) continue;

    const pruned: Record<string, any> = { ...value };
    pruned.payload = stripRunningHistoryFields(pruned.payload);
    if ('output' in pruned) pruned.output = stripRunningHistoryFields(pruned.output);
    if ('prevOutput' in pruned) pruned.prevOutput = stripRunningHistoryFields(pruned.prevOutput);
    context[key] = pruned as any;
  }
}

/**
 * `pruneSnapshot` hook for the internal agent workflows. Reduces a persisted
 * run snapshot to what resume actually reads: the suspended step's
 * `suspendPayload` (one live `__streamState` copy) plus engine routing state.
 * Copy-on-write — never mutates the snapshot it is given.
 */
export function pruneAgentLoopSnapshot({
  snapshot,
  workflowStatus,
}: {
  snapshot: WorkflowRunState;
  workflowStatus?: string;
}): WorkflowRunState {
  const isRunning = (workflowStatus ?? snapshot.status) === 'running';
  const activeStepIds = isRunning ? getActiveStepIds(snapshot) : new Set<string>();
  const context: WorkflowRunState['context'] = {} as WorkflowRunState['context'];
  for (const [key, value] of Object.entries(snapshot.context ?? {})) {
    if (key === 'input') {
      // `stripHeavyIterationFields` drops every `__`-prefixed key on the input
      // object, but the durable-agent workflow input carries a
      // `__workflowKind: 'durable-agent'` literal that identifies the snapshot
      // as recoverable (see `DurableAgent.recover` / `listActiveRuns`). Restore
      // it after pruning when the original input declared it — the strip is
      // still what drops heavy state like `__streamState`.
      const strippedInput = stripHeavyIterationFields(value ?? undefined) as Record<string, any> | undefined;
      const originalKind = isPlainObject(value) ? (value as Record<string, any>).__workflowKind : undefined;
      if (strippedInput && typeof originalKind === 'string') {
        strippedInput.__workflowKind = originalKind;
      }
      context.input = strippedInput;
    } else {
      context[key] = pruneStepResult(value as Record<string, any>, {
        preserveTerminalPayloadState: activeStepIds.has(key),
      }) as any;
    }
  }

  // `context` is freshly built above, so this is still copy-on-write with
  // respect to the caller's snapshot.
  if (isRunning) pruneRunningHistory(context, activeStepIds);

  const result =
    isPlainObject(snapshot.result) && typeof snapshot.result.status === 'string'
      ? pruneResultMirror(snapshot.result)
      : snapshot.result;

  return { ...snapshot, context, result };
}
