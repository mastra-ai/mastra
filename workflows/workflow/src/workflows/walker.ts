import type {
  MastraOp,
  MastraOpRequest,
  MastraOpResponse,
  MastraRunnerParams,
  MastraRunnerResult,
  SerializedOpError,
} from '../types';

/**
 * Deterministic walker over a Mastra serialized step graph.
 *
 * This module runs inside the Workflow SDK's sandbox, so it deliberately has
 * no runtime imports — only erased `import type`s. Every effect it needs
 * (running a Mastra callable, sleeping, waiting on a hook, emitting events) is
 * injected through {@link WalkerEffects}. That keeps both `@mastra/core` and
 * Node builtins out of the workflow bundle and makes the walk unit-testable
 * without a workflow runtime.
 */

/** Effects the walker needs from its host runtime. */
export interface WalkerEffects {
  /** Runs one Mastra callable on the host. Must be durable and replay-safe. */
  runOp(request: MastraOpRequest): Promise<MastraOpResponse>;
  /** Durable sleep, in milliseconds. */
  sleepMs(ms: number): Promise<void>;
  /**
   * Registers a hook under `token` and resolves with its resume payload.
   *
   * `onRegistered` runs once the hook is durably registered and before the
   * payload is awaited. The walker uses it to publish the suspended event, so a
   * caller that reacts to that event by resuming can never beat the
   * registration and get `HookNotFoundError`.
   */
  awaitResume(token: string, onRegistered: () => Promise<void>): Promise<unknown>;
  /** Publishes Mastra stream events for observers of this run. */
  emit(events: MastraStreamEventLike[]): Promise<void>;
}

/** Loose shape of a Mastra `WorkflowStreamEvent`, kept structural for the sandbox. */
export interface MastraStreamEventLike {
  type: string;
  runId?: string;
  from?: string;
  payload: Record<string, unknown>;
}

export interface WalkerParams extends MastraRunnerParams {
  /** Per-step retry attempts keyed by step id, resolved from the live graph. */
  stepRetries?: Record<string, number>;
  /** Workflow-level retry defaults, used when a step has no explicit count. */
  retryConfig?: { attempts?: number; delay?: number };
}

/**
 * Serialized graph entries, restated structurally.
 *
 * The walker cannot import `SerializedStepFlowEntry` as a value and does not
 * want `@mastra/core` in its type graph either, so it models only the fields it
 * actually reads.
 */
interface SerializedStepLike {
  id: string;
  /** Present only on nested workflows, which are not supported yet. */
  serializedStepFlow?: unknown[];
  component?: string;
}

type BranchEntry = { type: 'step'; step: SerializedStepLike };

type SerializedEntry =
  | BranchEntry
  | { type: 'sleep'; id: string; duration?: number; fn?: string }
  | { type: 'sleepUntil'; id: string; date?: string | Date; fn?: string }
  | { type: 'parallel'; steps: BranchEntry[] }
  | {
      type: 'conditional';
      steps: BranchEntry[];
      serializedConditions: { id: string; fn: string }[];
    }
  | {
      type: 'loop';
      step: SerializedStepLike;
      serializedCondition: { id: string; fn: string };
      loopType: 'dowhile' | 'dountil';
    }
  | { type: 'foreach'; step: SerializedStepLike; opts?: { concurrency?: number; fn?: string } };

/** Thrown by `bail()`; unwinds the walk and finishes the run early. */
class BailSignal {
  constructor(public readonly output: unknown) {}
}

/** Thrown when a step fails terminally; unwinds the walk into a failed result. */
class StepFailureSignal {
  constructor(public readonly error: SerializedOpError) {}
}

/**
 * Hook token that a suspended step waits on.
 *
 * `WorkflowSdkRun#resume()` reconstructs this from the run id and step id, so the
 * shape is part of the package's public contract. Foreach elements append their
 * index because several copies of one step can be suspended at once.
 */
export function suspendToken(runId: string, stepId: string, foreachIndex?: number): string {
  return foreachIndex === undefined
    ? `mastra:${runId}:${stepId}`
    : `mastra:${runId}:${stepId}:${foreachIndex}`;
}

function unsupported(feature: string): Error {
  return new Error(
    `${feature} is not yet supported by @mastra/workflow. ` +
      `See the package README for the list of supported workflow features.`,
  );
}

export function toSerializedError(error: unknown): SerializedOpError {
  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; name?: unknown; stack?: unknown };
    if (typeof candidate.message === 'string') {
      return {
        message: candidate.message,
        name: typeof candidate.name === 'string' ? candidate.name : undefined,
        stack: typeof candidate.stack === 'string' ? candidate.stack : undefined,
      };
    }
  }
  return { message: String(error) };
}

/**
 * Walks `params.serializedStepGraph` to completion.
 *
 * Always resolves — failures come back as a `failed` result rather than a
 * rejection, so the Workflow SDK run itself completes and callers read the Mastra
 * status off the return value.
 */
export async function runMastraGraph(
  params: WalkerParams,
  effects: WalkerEffects,
): Promise<MastraRunnerResult> {
  const graph = (params.serializedStepGraph ?? []) as SerializedEntry[];
  const state: Record<string, unknown> = { ...(params.initialState ?? {}) };
  const stepResults: Record<string, unknown> = {};
  const initData = params.inputData;
  const defaultAttempts = params.retryConfig?.attempts ?? 0;
  const retryDelay = params.retryConfig?.delay ?? 0;

  /**
   * Runs one op once and folds any state mutation back into the run.
   *
   * `expectedId` guards replay. The Workflow SDK matches journal entries by
   * position and checks only the step function's name on replay, and every op
   * in this walk goes through the same `executeMastraOp` function — so that
   * check cannot distinguish two different graph nodes. Comparing the identity
   * the host echoed back against the node we are standing on restores the
   * guarantee: if a walk ever replays in a different order than it was
   * recorded, this throws instead of quietly handing one node's output to
   * another.
   */
  async function invoke(
    op: MastraOp,
    inputData: unknown,
    expectedId: string,
    extra: Partial<MastraOpRequest> = {},
  ): Promise<MastraOpResponse> {
    const response = await effects.runOp({
      workflowId: params.workflowId,
      runId: params.runId,
      resourceId: params.resourceId,
      op,
      inputData,
      state,
      initData,
      stepResults,
      requestContext: params.requestContext ?? [],
      ...extra,
    });

    const expected = `${op.kind}@${op.path.join('.')}#${expectedId}`;
    if (response.identity !== expected) {
      throw new Error(
        `Workflow replay diverged: expected "${expected}" at this point in the graph, ` +
          `but the recorded result was for "${response.identity}". The step graph ` +
          `changed between the original run and this replay, or the walk is not ` +
          `deterministic.`,
      );
    }

    // The host owns `setState()` during a step, so its copy wins afterwards.
    for (const key of Object.keys(state)) {
      delete state[key];
    }
    Object.assign(state, response.state ?? {});
    return response;
  }

  /** Runs a non-step callable (condition, sleep resolver) and unwraps its value. */
  async function invokeValue(
    op: MastraOp,
    inputData: unknown,
    expectedId: string,
    extra: Partial<MastraOpRequest> = {},
  ) {
    const response = await invoke(op, inputData, expectedId, extra);
    if (response.status === 'failed') {
      throw new StepFailureSignal(response.error);
    }
    if (response.status === 'suspended') {
      throw new Error(
        `A condition or resolver function suspended, which @mastra/workflow does not support. ` +
          `Only step \`execute\` functions may call suspend().`,
      );
    }
    return response.output;
  }

  function assertPlainStep(step: SerializedStepLike): void {
    if (step.serializedStepFlow) {
      throw unsupported(`Nested workflow step "${step.id}"`);
    }
  }

  /**
   * Runs one Mastra step to a terminal outcome.
   *
   * Two loops are layered here: an outer retry loop bounded by the step's
   * configured attempts, and an inner suspend loop that parks on a hook and
   * re-invokes the step with the resume payload until it stops suspending.
   */
  async function runStep(
    step: SerializedStepLike,
    path: number[],
    inputData: unknown,
    foreachIndex?: number,
  ): Promise<unknown> {
    assertPlainStep(step);

    const attempts = params.stepRetries?.[step.id] ?? defaultAttempts;
    const op: MastraOp = { kind: 'step', path };

    await effects.emit([
      {
        type: 'workflow-step-start',
        runId: params.runId,
        payload: { id: step.id, status: 'running', payload: inputData },
      },
    ]);

    let retryCount = 0;
    for (;;) {
      let resumeData: unknown;
      let response = await invoke(op, inputData, step.id, { retryCount, foreachIndex });

      // Suspend loop: park on a hook, then re-run the step with its payload.
      while (response.status === 'suspended') {
        const token = suspendToken(params.runId, step.id, foreachIndex);
        const suspendedResponse = response;
        stepResults[step.id] = {
          status: 'suspended',
          payload: inputData,
          suspendPayload: response.suspendPayload,
          startedAt: response.startedAt,
          suspendedAt: response.suspendedAt,
        };

        // The suspended event is published from inside `awaitResume`, after the
        // hook exists. Announcing the suspension first would invite a caller to
        // resume a token that is not registered yet.
        resumeData = await effects.awaitResume(token, () =>
          effects.emit([
            {
              type: 'workflow-step-suspended',
              runId: params.runId,
              payload: {
                id: step.id,
                status: 'suspended',
                payload: inputData,
                suspendPayload: suspendedResponse.suspendPayload,
                resumeToken: token,
              },
            },
          ]),
        );
        response = await invoke(op, inputData, step.id, {
          retryCount,
          foreachIndex,
          resumeData,
        });
      }

      if (response.status === 'failed') {
        const canRetry = retryCount < attempts && !response.error.nonRetryable;
        if (canRetry) {
          retryCount += 1;
          if (retryDelay > 0) {
            await effects.sleepMs(retryDelay);
          }
          continue;
        }
        stepResults[step.id] = {
          status: 'failed',
          error: response.error,
          payload: inputData,
          startedAt: response.startedAt,
          endedAt: response.endedAt,
        };
        await effects.emit([
          {
            type: 'workflow-step-result',
            runId: params.runId,
            payload: { id: step.id, status: 'failed', error: response.error },
          },
        ]);
        throw new StepFailureSignal(response.error);
      }

      stepResults[step.id] = {
        status: 'success',
        output: response.output,
        payload: inputData,
        ...(resumeData === undefined ? {} : { resumePayload: resumeData }),
        startedAt: response.startedAt,
        endedAt: response.endedAt,
      };
      await effects.emit([
        {
          type: 'workflow-step-result',
          runId: params.runId,
          payload: { id: step.id, status: 'success', output: response.output },
        },
        { type: 'workflow-step-finish', runId: params.runId, payload: { id: step.id, metadata: {} } },
      ]);

      if (response.status === 'bailed') {
        throw new BailSignal(response.output);
      }
      return response.output;
    }
  }

  async function runEntry(entry: SerializedEntry, path: number[], inputData: unknown): Promise<unknown> {
    switch (entry.type) {
      case 'step':
        return runStep(entry.step, path, inputData);

      case 'sleep': {
        const ms =
          entry.duration ??
          (entry.fn ? Number(await invokeValue({ kind: 'sleep-duration', path }, inputData, entry.id)) : 0);
        await effects.sleepMs(Number.isFinite(ms) ? Math.max(0, ms) : 0);
        return inputData;
      }

      case 'sleepUntil': {
        let target: number;
        if (entry.date != null) {
          target = new Date(entry.date as string).getTime();
        } else if (entry.fn) {
          target = new Date(
            (await invokeValue({ kind: 'sleep-until-date', path }, inputData, entry.id)) as
              | string
              | number,
          ).getTime();
        } else {
          target = Date.now();
        }
        // `Date.now()` inside the sandbox is replay-stable, so the computed
        // delay is identical on every replay of this entry.
        const ms = Number.isFinite(target) ? Math.max(0, target - Date.now()) : 0;
        await effects.sleepMs(ms);
        return inputData;
      }

      case 'parallel': {
        const outputs = await Promise.all(
          entry.steps.map((branch, branchIndex) =>
            runStep(branch.step, [...path, branchIndex], inputData),
          ),
        );
        const merged: Record<string, unknown> = {};
        entry.steps.forEach((branch, branchIndex) => {
          merged[branch.step.id] = outputs[branchIndex];
        });
        return merged;
      }

      case 'conditional': {
        const truthy = await Promise.all(
          entry.serializedConditions.map((_condition, conditionIndex) =>
            invokeValue(
              { kind: 'condition', path, conditionIndex },
              inputData,
              `condition_${conditionIndex}`,
            ),
          ),
        );
        const merged: Record<string, unknown> = {};
        // Branches run sequentially so their step results land in a stable
        // order; the conditions above already ran concurrently.
        for (let branchIndex = 0; branchIndex < entry.steps.length; branchIndex++) {
          if (!truthy[branchIndex]) {
            continue;
          }
          const branch = entry.steps[branchIndex]!;
          merged[branch.step.id] = await runStep(branch.step, [...path, branchIndex], inputData);
        }
        return merged;
      }

      case 'loop': {
        let carried = inputData;
        let iterationCount = 0;
        for (;;) {
          carried = await runStep(entry.step, path, carried);
          const keepGoing = Boolean(
            await invokeValue({ kind: 'loop-condition', path }, carried, `${entry.step.id}_condition`, {
              iterationCount,
            }),
          );
          iterationCount += 1;
          // `dowhile` runs while the condition holds; `dountil` runs until it does.
          if (entry.loopType === 'dowhile' ? !keepGoing : keepGoing) {
            return carried;
          }
        }
      }

      case 'foreach': {
        const items = Array.isArray(inputData) ? inputData : [];
        let concurrency = entry.opts?.concurrency ?? 1;
        if (entry.opts?.fn) {
          concurrency = Number(
            await invokeValue(
              { kind: 'foreach-concurrency', path },
              inputData,
              `${entry.step.id}_concurrency`,
            ),
          );
        }
        const width = Number.isFinite(concurrency) ? Math.max(1, Math.floor(concurrency)) : 1;

        // Fixed-size batches rather than a worker pool: which element each
        // invocation handles must not depend on how fast its neighbours
        // resolve, or a replay could pair an element with a different journal
        // entry than the original run did.
        const outputs: unknown[] = [];
        for (let offset = 0; offset < items.length; offset += width) {
          const batch = items.slice(offset, offset + width);
          const settled = await Promise.all(
            batch.map((item, withinBatch) =>
              runStep(entry.step, path, item, offset + withinBatch),
            ),
          );
          outputs.push(...settled);
        }
        stepResults[entry.step.id] = {
          status: 'success',
          output: outputs,
          payload: inputData,
        };
        return outputs;
      }

      default: {
        const unknownEntry = entry as { type?: string };
        throw unsupported(`Step graph entry of type "${unknownEntry.type}"`);
      }
    }
  }

  await effects.emit([
    { type: 'workflow-start', runId: params.runId, payload: { runId: params.runId } },
  ]);

  let finish: MastraRunnerResult;
  try {
    let current: unknown = params.inputData;
    for (let index = 0; index < graph.length; index++) {
      current = await runEntry(graph[index]!, [index], current);
    }
    finish = {
      status: 'success',
      result: current,
      state,
      steps: stepResults,
      input: params.inputData,
    };
  } catch (error) {
    if (error instanceof BailSignal) {
      finish = {
        status: 'success',
        result: error.output,
        state,
        steps: stepResults,
        input: params.inputData,
      };
    } else if (error instanceof StepFailureSignal) {
      finish = {
        status: 'failed',
        error: error.error,
        state,
        steps: stepResults,
        input: params.inputData,
      };
    } else {
      finish = {
        status: 'failed',
        error: toSerializedError(error),
        state,
        steps: stepResults,
        input: params.inputData,
      };
    }
  }

  // `state` and `steps` ride along so a client watching the stream can build a
  // complete Mastra `WorkflowResult` without a second read of storage.
  await effects.emit([
    {
      type: 'workflow-finish',
      runId: params.runId,
      payload: {
        status: finish.status,
        result: finish.result,
        error: finish.error,
        state: finish.state,
        steps: finish.steps,
      },
    },
  ]);

  return finish;
}
