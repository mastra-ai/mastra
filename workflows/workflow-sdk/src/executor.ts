import { RequestContext } from '@mastra/core/di';
import { getErrorFromUnknown } from '@mastra/core/error';
import { PubSub } from '@mastra/core/events';
import type { Event, EventCallback } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import { EntityType, SpanType, createObservabilityContext, wrapMastra } from '@mastra/core/observability';
import type { AnySpan, ExportedSpan } from '@mastra/core/observability';
import { ToolStream } from '@mastra/core/tools';
import type {
  ExecutionGraph,
  SerializedStepFlowEntry,
  SingleStepEntry,
  Step,
  StepFlowEntry,
  SuspendOptions,
  WorkflowResumeLabel,
  WorkflowRunState,
} from '@mastra/core/workflows';
import {
  getEntryId,
  getEntrySchemas,
  runAgentEntry,
  runMappingEntry,
  runScorersForStep,
  runToolEntry,
  validateStepInput,
  validateStepRequestContext,
  validateStepStateData,
  validateStepSuspendData,
} from '@mastra/core/workflows';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '@mastra/core/workflows/_constants';
import { getWorkflowMetadata, getWritable } from 'workflow';
import { FINALIZE_IDENTITY, MASTRA_EVENT_NAMESPACE, PAUSE_IDENTITY_PREFIX, PER_STEP_TOKEN_KEY } from './constants';
import { requireRegisteredWorkflow } from './registry';
import { readSdkRunId, readSuspendTokens, SUSPEND_TOKENS_SNAPSHOT_KEY, withSdkRunId } from './snapshot';
import type { MastraOp, MastraOpRequest, MastraOpResponse, SerializedOpError } from './types';
import { suspendToken } from './workflows/walker';

/**
 * Host-side execution of a single Mastra callable.
 *
 * Reached only through the dynamic `import()` in `workflows/steps.ts`, so this
 * module — and everything it pulls in from `@mastra/core` — stays out of the
 * sandboxed workflow bundle.
 */

/**
 * Stand-in for the `PubSub` that Mastra's own engines hand to steps.
 *
 * Watch events reach subscribers through the Workflow SDK run stream instead, driven
 * by the walker so ordering is deterministic across replays. Accepting the
 * publishes and dropping them keeps steps that publish opportunistically from
 * crashing, without emitting each event twice.
 */
class InertPubSub extends PubSub {
  async publish(_topic: string, _event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {}
  async subscribe(_topic: string, _cb: EventCallback): Promise<void> {}
  async unsubscribe(_topic: string, _cb: EventCallback): Promise<void> {}
  async flush(): Promise<void> {}
}

function serializeError(error: unknown): SerializedOpError {
  if (error instanceof Error) {
    return {
      // Custom enumerable fields (statusCode, responseHeaders, …) first so the
      // canonical fields below always win on collision. `getErrorFromUnknown`
      // re-attaches them to the revived Error via Object.assign.
      ...serializableFields(error),
      message: error.message,
      name: error.name,
      stack: error.stack,
      // `MastraNonRetryableError` is matched by name so the check keeps working
      // whether the error came from core or was re-thrown across a boundary.
      nonRetryable:
        error.name === 'MastraNonRetryableError' || (error as { nonRetryable?: boolean }).nonRetryable === true,
      ...(error.cause === undefined ? {} : { cause: serializeCause(error.cause) }),
    };
  }
  return { message: String(error) };
}

/**
 * Best-effort JSON-safe projection of an error cause, recursing so the full
 * `cause` chain survives the sandbox boundary. ZodErrors keep their `issues`
 * this way, which is the part consumers (and the shared suite) rely on.
 */
function serializeCause(cause: unknown): unknown {
  if (cause instanceof Error) {
    return {
      ...serializableFields(cause),
      message: cause.message,
      name: cause.name,
      stack: cause.stack,
      ...(cause.cause === undefined ? {} : { cause: serializeCause(cause.cause) }),
    };
  }
  try {
    return JSON.parse(JSON.stringify(cause));
  } catch {
    return String(cause);
  }
}

/** JSON-safe copy of an error's own enumerable fields; non-serializable ones are dropped. */
function serializableFields(error: Error): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const key of Object.keys(error)) {
    if (key === 'cause') continue;
    try {
      fields[key] = JSON.parse(JSON.stringify((error as unknown as Record<string, unknown>)[key]));
    } catch {
      // drop non-serializable fields
    }
  }
  return fields;
}

/**
 * Deep-plainifies a stream chunk so it survives the Workflow SDK's structured
 * serialization boundary, which rejects non-POJO objects. Agent steps forward
 * their full model stream through the step writer, and finish chunks carry AI
 * SDK class instances (e.g. `DefaultStepResult`) whose data lives in own
 * enumerable fields — copying those into plain objects preserves the shape
 * consumers see on the default engine. Dates pass through (the serializer
 * supports them), functions/symbols are dropped, and circular refs are cut.
 */
function toSerializableChunk(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'function' || typeof value === 'symbol' ? undefined : value;
  }
  if (value instanceof Date) {
    return value;
  }
  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map(item => toSerializableChunk(item, seen));
    }
    const plain: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const converted = toSerializableChunk(entry, seen);
      if (converted !== undefined || entry === undefined) {
        plain[key] = converted;
      }
    }
    return plain;
  } finally {
    // Track only the current ancestor path so repeated (non-circular)
    // references elsewhere in the chunk are still copied.
    seen.delete(value);
  }
}

/** Walks `executionGraph.steps` to the entry a {@link MastraOp} addresses. */
function resolveEntry(graph: ExecutionGraph, path: number[]): StepFlowEntry {
  const [head, ...rest] = path;
  let entry: StepFlowEntry | undefined = graph.steps[head ?? -1];
  if (!entry) {
    throw new Error(`No step graph entry at index ${head} (path ${JSON.stringify(path)})`);
  }
  for (const index of rest) {
    if (entry.type !== 'parallel' && entry.type !== 'conditional') {
      throw new Error(
        `Cannot descend into a "${entry.type}" entry (path ${JSON.stringify(path)}). ` +
          `Only parallel and conditional entries have branches.`,
      );
    }
    const branch: StepFlowEntry | undefined = entry.steps[index];
    if (!branch) {
      throw new Error(`No branch at index ${index} (path ${JSON.stringify(path)})`);
    }
    entry = branch;
  }
  return entry;
}

/** Returns the `Step` an op addresses, for the op kinds that target one. */
function resolveStep(
  entry: StepFlowEntry,
  path: number[],
  mastra?: Mastra,
): Step<any, any, any, any, any, any, any, any> {
  const inner: SingleStepEntry | undefined =
    entry.type === 'step' || entry.type === 'agent' || entry.type === 'tool' || entry.type === 'mapping'
      ? entry
      : entry.type === 'loop' || entry.type === 'foreach'
        ? entry.step
        : undefined;
  if (!inner) {
    throw new Error(`Entry at ${JSON.stringify(path)} is a "${entry.type}" and has no single step`);
  }
  if (inner.type !== 'step') {
    return materializeDeclarativeStep(inner, mastra);
  }
  return inner.step;
}

/**
 * Materializes a declarative entry (agent / tool / mapping) into a live step
 * shell around core's shared entry executors — the same interpretation both
 * core engines use, so behavior stays identical across engines (mirrors
 * `createStepFromAgent` / `createStepFromTool` / `createMappingStep`).
 */
function materializeDeclarativeStep(
  entry: Exclude<SingleStepEntry, { type: 'step' }>,
  mastra?: Mastra,
): Step<any, any, any, any, any, any, any, any> {
  const schemas = getEntrySchemas(entry, mastra);
  switch (entry.type) {
    case 'agent':
      return {
        id: entry.id,
        ...schemas,
        retries: entry.options?.retries,
        scorers: entry.options?.scorers,
        metadata: entry.options?.metadata,
        component: 'AGENT',
        execute: async (ctx: any) => runAgentEntry(entry, ctx, mastra),
      } as Step<any, any, any, any, any, any, any, any>;
    case 'tool':
      return {
        id: entry.id,
        ...schemas,
        retries: entry.options?.retries,
        scorers: entry.options?.scorers,
        metadata: entry.options?.metadata,
        component: 'TOOL',
        execute: async (ctx: any) => runToolEntry(entry, ctx, mastra),
      } as Step<any, any, any, any, any, any, any, any>;
    case 'mapping':
      return {
        id: entry.id,
        execute: async (ctx: any) => runMappingEntry(entry, ctx),
      } as Step<any, any, any, any, any, any, any, any>;
  }
}

interface ResolvedCallable {
  /** The function to invoke with a Mastra execution context. */
  fn: (params: any) => Promise<unknown>;
  /** Step whose schemas and id describe this call, when there is one. */
  step?: Step<any, any, any, any, any, any, any, any>;
  /** Identifier used for logging and stream naming. */
  id: string;
}

/**
 * See `MastraOpResponseBase.identity`.
 *
 * Ops inside nested workflows carry their `workflowPath` in the identity so a
 * nested node can never pair with a same-shaped top-level node on replay. Root
 * ops have no scope segment, keeping their identities unchanged from before
 * nesting existed.
 */
function opIdentity(op: MastraOp, resolvedId: string): string {
  const scope = op.workflowPath?.length ? `${op.workflowPath.map(p => p.join('.')).join('/')}/` : '';
  return `${op.kind}@${scope}${op.path.join('.')}#${resolvedId}`;
}

/**
 * The execution graph an op addresses: the root workflow's, or — when the op
 * carries a `workflowPath` — the graph of the nested workflow reached by
 * descending through each wrapper step in turn.
 *
 * `executionGraph` is protected on `Workflow`, hence the structural cast; the
 * wrapper step at each hop is a live `Workflow` instance, so its graph is the
 * committed one.
 */
function resolveOpGraph(rootGraph: ExecutionGraph, op: MastraOp): ExecutionGraph {
  let graph = rootGraph;
  for (const wrapperPath of op.workflowPath ?? []) {
    const step = resolveStep(resolveEntry(graph, wrapperPath), wrapperPath);
    const nested = step as unknown as { executionGraph?: ExecutionGraph };
    if (!nested.executionGraph) {
      throw new Error(
        `Step "${step.id}" at ${JSON.stringify(wrapperPath)} is not a nested workflow, ` +
          `but the op's workflowPath descends through it`,
      );
    }
    graph = nested.executionGraph;
  }
  return graph;
}

function resolveCallable(graph: ExecutionGraph, op: MastraOp, mastra?: Mastra): ResolvedCallable {
  const entry = resolveEntry(graph, op.path);

  switch (op.kind) {
    case 'step': {
      const step = resolveStep(entry, op.path, mastra);
      return { fn: step.execute as (params: any) => Promise<unknown>, step, id: step.id };
    }
    case 'condition': {
      if (entry.type !== 'conditional') {
        throw new Error(`Expected a conditional entry at ${JSON.stringify(op.path)}, got "${entry.type}"`);
      }
      const condition = entry.conditions[op.conditionIndex];
      if (!condition) {
        throw new Error(`No condition at index ${op.conditionIndex} of ${JSON.stringify(op.path)}`);
      }
      return {
        fn: condition as (params: any) => Promise<unknown>,
        id: `condition_${op.conditionIndex}`,
      };
    }
    case 'loop-condition': {
      if (entry.type !== 'loop') {
        throw new Error(`Expected a loop entry at ${JSON.stringify(op.path)}, got "${entry.type}"`);
      }
      return { fn: entry.condition as (params: any) => Promise<unknown>, id: `${getEntryId(entry.step)}_condition` };
    }
    case 'sleep-duration':
    case 'sleep-until-date': {
      if (entry.type !== 'sleep' && entry.type !== 'sleepUntil') {
        throw new Error(`Expected a sleep entry at ${JSON.stringify(op.path)}, got "${entry.type}"`);
      }
      if (!entry.fn) {
        throw new Error(`Sleep entry "${entry.id}" has no resolver function`);
      }
      return { fn: entry.fn as (params: any) => Promise<unknown>, id: entry.id };
    }
    case 'foreach-concurrency': {
      if (entry.type !== 'foreach') {
        throw new Error(`Expected a foreach entry at ${JSON.stringify(op.path)}, got "${entry.type}"`);
      }
      const resolver = entry.opts.concurrency;
      if (typeof resolver !== 'function') {
        throw new Error(`Foreach entry "${getEntryId(entry.step)}" has a static concurrency, not a resolver`);
      }
      return { fn: async (params: any) => resolver(params), id: `${getEntryId(entry.step)}_concurrency` };
    }
    default: {
      const exhaustive = op as { kind: string };
      throw new Error(`Unknown Mastra op kind "${exhaustive.kind}"`);
    }
  }
}

/**
 * Runs one Mastra callable and reports the outcome.
 *
 * Never rejects for a step-level failure: the walker in the sandbox decides
 * whether to retry, so an error thrown here would let the Workflow SDK runtime retry
 * the invocation as well and the two policies would compound.
 */
export async function runMastraOp(request: MastraOpRequest): Promise<MastraOpResponse> {
  const startedAt = Date.now();
  const state: Record<string, unknown> = { ...(request.state ?? {}) };

  // perStep pause. Storage-only, like finalize, but not terminal: the snapshot
  // is marked `paused` and carries the hook token the walker parks on next, so
  // `resume()` can find it. Lifecycle callbacks are skipped — the default
  // engine does not fire them for a pause either.
  if (request.op.kind === 'pause') {
    await persistSnapshot(request, state, 'paused', {
      suspendTokens: { [PER_STEP_TOKEN_KEY]: request.op.pauseToken },
    });
    return {
      identity: `${PAUSE_IDENTITY_PREFIX}${request.op.pauseSeq}`,
      status: 'success',
      output: undefined,
      state,
      startedAt,
      endedAt: Date.now(),
    };
  }

  // Terminal write. No graph node to resolve, and no user code to run.
  if (request.op.kind === 'finalize') {
    await persistSnapshot(request, state, request.op.status, {
      result: request.op.result,
      error: request.op.error,
    });
    await invokeLifecycleCallbacks(request, state, {
      status: request.op.status,
      result: request.op.result,
      error: request.op.error,
    });
    endWorkflowSpan(request, request.op);
    return {
      identity: FINALIZE_IDENTITY,
      status: 'success',
      output: undefined,
      state,
      startedAt,
      endedAt: Date.now(),
    };
  }

  // Only known once the callable resolves; until then the op's own address is
  // the best identity available, which is what a resolution failure reports.
  let identity = opIdentity(request.op, '<unresolved>');

  // Hoisted so the catch below can echo step-written mutations back even when
  // the step ultimately failed.
  let requestContext: RequestContext | undefined;
  // Hoisted so the catch below can record the failure on the step span.
  let activeStepSpan: AnySpan | undefined;
  // Hoisted so the catch below can tell an abort caused by `run.cancel()`
  // apart from a genuine step failure.
  let externallyCanceled = false;
  const contextEntries = () =>
    requestContext ? (Array.from(requestContext.entries()) as [string, unknown][]) : undefined;

  try {
    const workflow = requireRegisteredWorkflow(request.workflowId);
    const { fn, step, id } = resolveCallable(
      resolveOpGraph(workflow.executionGraph, request.op),
      request.op,
      workflow.mastra,
    );
    identity = opIdentity(request.op, id);

    // Dotted id nested steps are known by everywhere outside their own graph:
    // events, snapshots and suspend tokens all use it.
    const qualifiedId = request.stepIdPrefix ? `${request.stepIdPrefix}.${id}` : id;

    // Per-op step span, correlated to the run's root span by persisted ids
    // (the host is stateless across ops, so no live parent span object exists —
    // same technique the Inngest engine uses for durable tracing). Only step
    // ops get spans; condition/sleep resolvers are internal plumbing.
    const stepSpan = request.op.kind === 'step' ? startStepSpan(request, workflow, qualifiedId) : undefined;
    activeStepSpan = stepSpan;

    let suspended: { payload: unknown } | undefined;
    let bailed: { payload: unknown } | undefined;
    const resumeLabels: Record<string, WorkflowResumeLabel> = {};
    const abortController = new AbortController();
    requestContext = new RequestContext((request.requestContext ?? []) as [string, {} | undefined][]);

    const isStepOp = request.op.kind === 'step' && step !== undefined;
    const validateInputs = workflow.executionEngine.options?.validateInputs ?? true;

    // Mirrors the default engine's per-step validation: schema defaults are
    // applied to the input, and a validation error fails the step the same way
    // a throw from user code would (the walker owns retries either way).
    let inputData = request.inputData;
    if (isStepOp) {
      const { inputData: validatedInput, validationError: inputValidationError } = await validateStepInput({
        prevOutput: request.inputData,
        step,
        validateInputs,
      });
      const { validationError: requestContextValidationError } = await validateStepRequestContext({
        requestContext,
        step,
        validateInputs,
      });
      // Input validation takes precedence, matching core's handler.
      const validationError = inputValidationError || requestContextValidationError;
      if (validationError) {
        throw validationError;
      }
      inputData = validatedInput;
    }

    // Suspend data from this step's previous suspension, exposed like the
    // default engine does: iteration-scoped for foreach, with internal
    // `__workflow_meta` stripped before user code sees it.
    let suspendData: unknown;
    if (isStepOp) {
      const prior = request.stepResults?.[qualifiedId] as
        | { status?: string; suspendPayload?: Record<string, any> }
        | undefined;
      suspendData = prior?.status === 'suspended' ? prior.suspendPayload : undefined;
      if (suspendData && request.foreachIndex !== undefined) {
        const iteration = (suspendData as Record<string, any>).__workflow_meta?.foreachOutput?.[request.foreachIndex];
        if (iteration?.status === 'suspended' && iteration.suspendPayload) {
          suspendData = iteration.suspendPayload;
        }
      }
      if (suspendData && typeof suspendData === 'object' && '__workflow_meta' in suspendData) {
        const { __workflow_meta: _meta, ...userSuspendData } = suspendData as Record<string, unknown>;
        suspendData = userSuspendData;
      }
    }

    const writable = getWritable<Record<string, unknown>>({ namespace: MASTRA_EVENT_NAMESPACE });
    // ToolStream wraps user chunks itself (`workflow-step-output` with the
    // chunk under `payload.output`), so the callback forwards the wrapped
    // event as-is — wrapping again would bury the user chunk one level too
    // deep compared to the default engine's stream shape.
    const writer = new ToolStream(
      { prefix: 'workflow-step', callId: `${request.runId}:${qualifiedId}`, name: qualifiedId, runId: request.runId },
      async (chunk: unknown) => {
        // Plainified up front: user chunks (agent stream events in particular)
        // can carry class instances that the SDK's serializer rejects, and a
        // failed background flush of stream ops is fatal to the whole run.
        const event = toSerializableChunk(chunk) as Record<string, unknown>;
        const streamWriter = writable.getWriter();
        try {
          await streamWriter.write({
            ...event,
            runId: request.runId,
            payload: { id: qualifiedId, ...(event.payload as Record<string, unknown> | undefined) },
          });
        } finally {
          streamWriter.releaseLock();
        }
      },
    );

    const params = {
      runId: request.runId,
      resourceId: request.resourceId,
      workflowId: request.workflowId,
      // A tracing-wrapped Mastra proxy makes agent/workflow calls inside the
      // step parent under the step span, matching core's handler.
      mastra: workflow.mastra && stepSpan ? wrapMastra(workflow.mastra, { currentSpan: stepSpan }) : workflow.mastra,
      requestContext,
      actor: request.actor,
      inputData,
      // A snapshot, not the live object: the default engine's steps see their
      // own `state` binding unchanged by their own setState calls.
      state: { ...state },
      setState: async (next: Record<string, unknown>) => {
        let stateToUse = next;
        if (isStepOp) {
          const { stateData, validationError: stateValidationError } = await validateStepStateData({
            stateData: next,
            step,
            validateInputs,
          });
          if (stateValidationError) {
            throw stateValidationError;
          }
          stateToUse = stateData;
        }
        for (const key of Object.keys(state)) {
          delete state[key];
        }
        Object.assign(state, stateToUse ?? {});
      },
      retryCount: request.retryCount ?? 0,
      resumeData: request.resumeData,
      suspendData,
      getInitData: () => request.initData,
      getStepResult: (target: string | { id: string }) => {
        const key = typeof target === 'string' ? target : target?.id;
        if (!key) {
          return null;
        }
        // Step results live in one flat map keyed by qualified id, so a step
        // inside a nested workflow reads its siblings under its own prefix.
        const qualifiedKey = request.stepIdPrefix ? `${request.stepIdPrefix}.${key}` : key;
        const result = (request.stepResults?.[qualifiedKey] ?? request.stepResults?.[key]) as
          | { status?: string; output?: unknown }
          | undefined;
        return result?.status === 'success' ? result.output : null;
      },
      suspend: async (payload?: unknown, suspendOptions?: SuspendOptions) => {
        let payloadToUse = payload;
        if (isStepOp) {
          const { suspendData: validatedSuspendData, validationError: suspendValidationError } =
            await validateStepSuspendData({
              suspendData: payload,
              step,
              validateInputs,
            });
          if (suspendValidationError) {
            throw suspendValidationError;
          }
          payloadToUse = validatedSuspendData;
        }
        if (suspendOptions?.resumeLabel) {
          const labels = Array.isArray(suspendOptions.resumeLabel)
            ? suspendOptions.resumeLabel
            : [suspendOptions.resumeLabel];
          for (const label of labels) {
            resumeLabels[label] = { stepId: qualifiedId, foreachIndex: request.foreachIndex };
          }
        }
        suspended = { payload: payloadToUse };
      },
      bail: (result: unknown) => {
        bailed = { payload: result };
      },
      abort: () => abortController.abort(),
      abortSignal: abortController.signal,
      writer,
      engine: {},
      // tracingContext/loggerContext derived from the step span, mirroring
      // core's `...createObservabilityContext({ currentSpan: stepSpan })`.
      ...createObservabilityContext({ currentSpan: stepSpan }),
      iterationCount: request.iterationCount,
      // Mirrors core's handler exactly (including its inverted-looking guard):
      // "Disable scorers must be explicitly set to false they are on by default".
      scorers: request.disableScorers === false ? undefined : step?.scorers,
      validateInputs,
      [PUBSUB_SYMBOL]: new InertPubSub(),
      [STREAM_FORMAT_SYMBOL]: 'vnext' as const,
      ...(request.resumeData === undefined
        ? {}
        : { resume: { steps: step ? [step.id] : [], resumePayload: request.resumeData } }),
    };

    // Best-effort external-cancel propagation: `run.cancel()` (possibly from
    // another process) cancels the SDK run and marks the stored snapshot
    // `canceled`. The marker is the only channel into an op already running on
    // the host, so step ops check it up front and poll it while user code runs,
    // firing the local abort signal when it appears. A mid-flight step may
    // still complete before a poll notices — best-effort by design.
    let cancelPoll: ReturnType<typeof setInterval> | undefined;
    if (isStepOp) {
      if (await isRunCanceled(request)) {
        // Reuses the `abort()` path instead of adding a response variant: the
        // walker treats a success response carrying `aborted` as the run being
        // canceled. Normally the sandbox is already dead by now and never reads
        // this — the check matters for the race where the marker landed before
        // the SDK-side cancel did.
        stepSpan?.end({ attributes: { status: 'canceled' } });
        return {
          identity,
          status: 'success',
          output: undefined,
          state,
          startedAt,
          endedAt: Date.now(),
          requestContext: contextEntries(),
          aborted: true,
        };
      }
      cancelPoll = setInterval(() => {
        void isRunCanceled(request).then(canceled => {
          if (canceled && !abortController.signal.aborted) {
            externallyCanceled = true;
            abortController.abort();
          }
        });
      }, CANCEL_POLL_INTERVAL_MS);
      // The poll must not keep the host process alive (Node-only nicety).
      (cancelPoll as unknown as { unref?: () => void }).unref?.();
    }

    let output: unknown;
    try {
      output = await fn(params);
    } finally {
      if (cancelPoll) {
        clearInterval(cancelPoll);
      }
    }

    if (externallyCanceled) {
      // Mirrors the default engine, where the running execution observes the
      // abort signal and fires the lifecycle callbacks with `canceled`. The
      // canceled snapshot written by `cancel()` stays untouched, and the
      // response is one the (already canceled) sandbox would treat as a
      // cancellation if it ever read it.
      await invokeCanceledLifecycleCallbacksOnce(request, state);
      stepSpan?.end({ attributes: { status: 'canceled' } });
      return {
        identity,
        status: 'success',
        output,
        state,
        startedAt,
        endedAt: Date.now(),
        requestContext: contextEntries(),
        aborted: true,
      };
    }

    // Same placement as core's handler: scorers run whenever the step function
    // returned (even if it suspended or bailed), and `runScorersForStep` itself
    // honors `disableScorers`.
    if (isStepOp && step?.scorers) {
      await runScorersForStep({
        engine: workflow.executionEngine,
        scorers: step.scorers,
        runId: request.runId,
        input: inputData,
        output,
        workflowId: request.workflowId,
        stepId: qualifiedId,
        requestContext,
        disableScorers: request.disableScorers,
      });
    }

    if (suspended) {
      const suspendedAt = Date.now();
      // Record which step is waiting, not just that something is: readers of
      // the snapshot — the playground, and anything building a resume UI — need
      // the step id to know what to ask for. The token mirrors the one the
      // walker parks on (including its park sequence) so `resume()` reads it
      // back instead of reconstructing a possibly stale first-park token.
      await persistSnapshot(request, state, 'suspended', {
        suspendedPaths: { [qualifiedId]: request.op.path },
        resumeLabels,
        suspendTokens: {
          // Foreach copies of one step suspend side by side, so each index
          // keeps its own token entry.
          [request.foreachIndex === undefined ? qualifiedId : `${qualifiedId}:${request.foreachIndex}`]: suspendToken(
            request.runId,
            qualifiedId,
            request.foreachIndex,
            request.suspendSeq,
          ),
        },
      });
      // The run settles as suspended from the caller's perspective, which is
      // when the default engine fires `onFinish` — mirror that here.
      await invokeLifecycleCallbacks(request, state, {
        status: 'suspended',
        steps: {
          ...(request.stepResults ?? {}),
          [qualifiedId]: {
            status: 'suspended',
            payload: inputData,
            suspendPayload: suspended.payload,
          },
        },
      });
      stepSpan?.end({ output: suspended.payload, attributes: { status: 'suspended' } });
      return {
        identity,
        status: 'suspended',
        suspendPayload: suspended.payload,
        state,
        startedAt,
        suspendedAt,
        requestContext: contextEntries(),
      };
    }
    if (bailed) {
      stepSpan?.end({ output: bailed.payload, attributes: { status: 'bailed' } });
      return {
        identity,
        status: 'bailed',
        output: bailed.payload,
        state,
        startedAt,
        endedAt: Date.now(),
        requestContext: contextEntries(),
      };
    }
    if (request.op.kind === 'step') {
      await persistSnapshot(request, state, 'running', {
        settledStepId: qualifiedId,
        settledForeachIndex: request.foreachIndex,
      });
    }
    stepSpan?.end({ output, attributes: { status: 'success' } });
    return {
      identity,
      status: 'success',
      output,
      state,
      startedAt,
      endedAt: Date.now(),
      requestContext: contextEntries(),
      // `abort()` from step code cancels the run; the walker acts on this
      // after recording the step's own (successful) result.
      ...(abortController.signal.aborted ? { aborted: true } : {}),
    };
  } catch (error) {
    if (externallyCanceled) {
      // The step rejected because `run.cancel()` fired its abort signal — that
      // is a cancellation, not a step failure. Same handling as the settled
      // external-cancel path above.
      await invokeCanceledLifecycleCallbacksOnce(request, state);
      activeStepSpan?.end({ attributes: { status: 'canceled' } });
      return {
        identity,
        status: 'success',
        output: undefined,
        state,
        startedAt,
        endedAt: Date.now(),
        requestContext: contextEntries(),
        aborted: true,
      };
    }
    activeStepSpan?.error({ error: getErrorFromUnknown(error, { serializeStack: false }) });
    return {
      identity,
      status: 'failed',
      error: serializeError(error),
      state,
      startedAt,
      endedAt: Date.now(),
      requestContext: contextEntries(),
    };
  }
}

/**
 * Starts a `WORKFLOW_STEP` span for one step op, correlated into the run's
 * trace by the persisted ids from `start()`. Returns `undefined` when tracing
 * is off or no ids were threaded through (tracing must never fail an op).
 */
function startStepSpan(
  request: MastraOpRequest,
  workflow: ReturnType<typeof requireRegisteredWorkflow>,
  stepId: string,
): AnySpan | undefined {
  if (!request.tracingIds) {
    return undefined;
  }
  try {
    const observability = workflow.mastra?.observability?.getSelectedInstance({});
    return observability?.startSpan({
      type: SpanType.WORKFLOW_STEP,
      name: `workflow step: '${stepId}'`,
      entityType: EntityType.WORKFLOW_STEP,
      entityId: stepId,
      input: request.inputData,
      traceId: request.tracingIds.traceId,
      parentSpanId: request.tracingIds.workflowSpanId,
    });
  } catch {
    return undefined;
  }
}

/**
 * Ends (or errors) the run's root `WORKFLOW_RUN` span during finalize by
 * rebuilding it from the exported form carried in the runner params — the
 * process that created it is long gone by the time the run settles.
 */
function endWorkflowSpan(
  request: MastraOpRequest,
  op: { status: 'success' | 'failed' | 'canceled'; result?: unknown },
): void {
  if (!request.workflowSpanData) {
    return;
  }
  try {
    const workflow = requireRegisteredWorkflow(request.workflowId);
    const observability = workflow.mastra?.observability?.getSelectedInstance({});
    const span = observability?.rebuildSpan(request.workflowSpanData as unknown as ExportedSpan<SpanType.WORKFLOW_RUN>);
    if (!span) {
      return;
    }
    if (op.status === 'failed') {
      const failedOp = request.op as { error?: SerializedOpError };
      span.error({
        error: getErrorFromUnknown(failedOp.error ?? new Error('workflow failed'), { serializeStack: false }),
      });
    } else if (op.status === 'canceled') {
      // Mirrors the default engine: a canceled run ends its root span with a
      // status attribute rather than an error.
      span.end({ attributes: { status: 'canceled' } });
    } else {
      span.end({ output: op.result });
    }
  } catch {
    // Tracing must never fail finalize.
  }
}

/**
 * Fires the workflow's `onFinish`/`onError` lifecycle callbacks host-side.
 *
 * The default engine invokes these whenever a run settles from the caller's
 * perspective (terminal finalize, or a suspension handing control back). The
 * sandbox walker cannot hold the callback closures, so the dispatcher invokes
 * them at the same settle points. Best-effort by design: callback errors are
 * caught inside `invokeLifecycleCallbacks`, and a resolution failure here must
 * not fail an otherwise good op.
 */
async function invokeLifecycleCallbacks(
  request: MastraOpRequest,
  state: Record<string, unknown>,
  outcome: {
    status: 'success' | 'failed' | 'suspended' | 'canceled';
    result?: unknown;
    error?: SerializedOpError;
    steps?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const workflow = requireRegisteredWorkflow(request.workflowId);
    await workflow.executionEngine.invokeLifecycleCallbacks({
      status: outcome.status,
      result: outcome.result,
      error: outcome.error ? getErrorFromUnknown(outcome.error, { serializeStack: false }) : undefined,
      steps: (outcome.steps ?? request.stepResults ?? {}) as never,
      runId: request.runId,
      workflowId: request.workflowId,
      resourceId: request.resourceId,
      input: request.initData,
      requestContext: new RequestContext((request.requestContext ?? []) as [string, {} | undefined][]),
      state,
    });
  } catch {
    // Lifecycle callbacks must never fail the run.
  }
}

/**
 * How often an in-flight step op re-reads the stored snapshot to notice an
 * external `run.cancel()`. One cheap storage read per tick, only while user
 * code is actually running.
 */
const CANCEL_POLL_INTERVAL_MS = 500;

/**
 * Whether `run.cancel()` has marked this run canceled in storage.
 *
 * Storage is the only channel from a cancelling process into an op already
 * running on the host, so this is inherently best-effort: no storage (or a
 * read error) reads as "not canceled".
 */
async function isRunCanceled(request: MastraOpRequest): Promise<boolean> {
  try {
    const workflow = requireRegisteredWorkflow(request.workflowId);
    const store = await workflow.mastra?.getStorage()?.getStore('workflows');
    if (!store) {
      return false;
    }
    const snapshot = await store.loadWorkflowSnapshot({ workflowName: request.workflowId, runId: request.runId });
    return snapshot?.status === 'canceled';
  } catch {
    return false;
  }
}

/**
 * `onFinish` with `status: 'canceled'` for an externally canceled run, at most
 * once per run from this process.
 *
 * The default engine has exactly one execution observing the abort signal; here
 * several parallel ops can notice the cancel marker at once, so the dedupe
 * keeps user callbacks from firing per-op. (Per-process only — a second host
 * process would fire again. Best-effort, like the rest of cancellation.)
 */
const canceledCallbackRuns = new Set<string>();
async function invokeCanceledLifecycleCallbacksOnce(
  request: MastraOpRequest,
  state: Record<string, unknown>,
): Promise<void> {
  const key = `${request.workflowId}:${request.runId}`;
  if (canceledCallbackRuns.has(key)) {
    return;
  }
  canceledCallbackRuns.add(key);
  await invokeLifecycleCallbacks(request, state, { status: 'canceled' });
}

/**
 * The Workflow SDK run id of the run this step belongs to.
 *
 * Returns `undefined` when called outside a step — unit tests drive
 * {@link runMastraOp} directly, and a missing id must not fail the op.
 */
function currentSdkRunId(): string | undefined {
  try {
    return getWorkflowMetadata().workflowRunId;
  } catch {
    return undefined;
  }
}

/**
 * Serializes snapshot writes per run: concurrent ops (parallel branches,
 * foreach iterations) each read-merge-write the whole snapshot, and unordered
 * writes would drop each other's suspend tokens and resume labels.
 */
const snapshotWriteQueues = new Map<string, Promise<void>>();

async function persistSnapshot(...args: Parameters<typeof doPersistSnapshot>): Promise<void> {
  const [request] = args;
  const key = `${request.workflowId}:${request.runId}`;
  const queued = (snapshotWriteQueues.get(key) ?? Promise.resolve()).then(() => doPersistSnapshot(...args));
  snapshotWriteQueues.set(key, queued);
  try {
    await queued;
  } finally {
    if (snapshotWriteQueues.get(key) === queued) {
      snapshotWriteQueues.delete(key);
    }
  }
}

/**
 * Mirrors the run into Mastra storage so `getWorkflowRunById()` and the
 * playground can see it, and so another process can map this Mastra run back
 * to its Workflow SDK run (see `snapshot.ts`).
 *
 * Best-effort by design: the Workflow SDK event log is the source of truth for
 * execution, and a storage hiccup should not fail an otherwise good step.
 */
async function doPersistSnapshot(
  request: MastraOpRequest,
  state: Record<string, unknown>,
  status: WorkflowRunState['status'],
  /**
   * Extra snapshot fields for this write: the terminal outcome that only the
   * `finalize` op has, and the suspended step that only a suspend has.
   */
  outcome: {
    result?: unknown;
    error?: SerializedOpError;
    suspendedPaths?: Record<string, number[]>;
    resumeLabels?: Record<string, WorkflowResumeLabel>;
    suspendTokens?: Record<string, string>;
    /**
     * Qualified id of a step that just settled: its suspended-path, token and
     * label entries are dropped so a later `resume()` cannot target it again.
     */
    settledStepId?: string;
    /**
     * When the settled step is one foreach iteration, only that index's
     * entries are dropped — sibling iterations may still be parked.
     */
    settledForeachIndex?: number;
  } = {},
): Promise<void> {
  try {
    const workflow = requireRegisteredWorkflow(request.workflowId);
    // Same contract as the default engine: the workflow-level predicate can
    // veto any snapshot write for a given status/step-results combination.
    const shouldPersist = workflow.executionEngine.options?.shouldPersistSnapshot;
    if (
      shouldPersist &&
      !shouldPersist({
        stepResults: (request.stepResults ?? {}) as Parameters<typeof shouldPersist>[0]['stepResults'],
        workflowStatus: status,
      })
    ) {
      return;
    }
    const store = await workflow.mastra?.getStorage()?.getStore('workflows');
    if (!store) {
      return;
    }
    const previous = await store
      .loadWorkflowSnapshot({ workflowName: request.workflowId, runId: request.runId })
      .catch(() => null);
    // Merged, not replaced: snapshots are persisted whole, and a write for one
    // step must not erase the live token of a still-suspended parallel sibling.
    const suspendTokens = { ...readSuspendTokens(previous), ...(outcome.suspendTokens ?? {}) };
    // A perStep pause token is single-use: any write after the pause means the
    // walker was resumed past it, so a stale copy must not survive for a later
    // `resume()` to target.
    if (status !== 'paused') {
      delete suspendTokens[PER_STEP_TOKEN_KEY];
    }
    const suspendedPaths = { ...(previous?.suspendedPaths ?? {}), ...(outcome.suspendedPaths ?? {}) };
    const resumeLabels = { ...(previous?.resumeLabels ?? {}), ...(outcome.resumeLabels ?? {}) };
    if (outcome.settledStepId) {
      const settledId = outcome.settledStepId;
      const settledIndex = outcome.settledForeachIndex;
      if (settledIndex === undefined) {
        delete suspendedPaths[settledId];
        for (const key of Object.keys(suspendTokens)) {
          if (key === settledId || key.startsWith(`${settledId}:`)) {
            delete suspendTokens[key];
          }
        }
      } else {
        delete suspendTokens[`${settledId}:${settledIndex}`];
        // The step-level suspended path only clears once no iteration is parked.
        if (!Object.keys(suspendTokens).some(key => key === settledId || key.startsWith(`${settledId}:`))) {
          delete suspendedPaths[settledId];
        }
      }
      for (const [label, target] of Object.entries(resumeLabels)) {
        if (target.stepId === settledId && (settledIndex === undefined || target.foreachIndex === settledIndex)) {
          delete resumeLabels[label];
        }
      }
    }
    const isTerminal = status === 'success' || status === 'failed' || status === 'canceled';
    await store.persistWorkflowSnapshot({
      workflowName: request.workflowId,
      runId: request.runId,
      resourceId: request.resourceId,
      snapshot: withSdkRunId(
        {
          runId: request.runId,
          status,
          ...(outcome.result === undefined ? {} : { result: outcome.result as WorkflowRunState['result'] }),
          ...(outcome.error === undefined ? {} : { error: outcome.error as WorkflowRunState['error'] }),
          value: state as WorkflowRunState['value'],
          context: request.stepResults as WorkflowRunState['context'],
          activePaths: [],
          activeStepsPath: {},
          waitingPaths: {},
          // Terminal runs have nothing left to resume; live runs keep parallel
          // siblings' suspended entries alongside this write's.
          suspendedPaths: isTerminal ? {} : suspendedPaths,
          resumeLabels: isTerminal ? {} : resumeLabels,
          serializedStepGraph: workflow.serializedStepGraph as SerializedStepFlowEntry[],
          timestamp: Date.now(),
          ...(Object.keys(suspendTokens).length ? { [SUSPEND_TOKENS_SNAPSHOT_KEY]: suspendTokens } : {}),
        },
        currentSdkRunId() ?? readSdkRunId(previous),
      ),
    });
  } catch {
    // Storage is optional for Workflow SDK-backed runs.
  }
}
