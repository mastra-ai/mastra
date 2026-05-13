/**
 * Shared mock agent for harness v1 tests.
 *
 * Why this exists:
 *   The harness sits above the agent layer. Spinning up a real model (or even
 *   a `MockLanguageModelV2` wired through the full agent loop) for harness
 *   tests forces us through ai-sdk → provider → response-parser → loop. None
 *   of that is what harness tests are about — we want to assert that Session
 *   forwards the right call shape, drains `fullStream` correctly, captures
 *   suspends, threads queue ids through events, etc.
 *
 *   So instead we hand the harness a duck-typed Agent whose stream/generate/
 *   resumeStream return programmable `MastraModelOutput`-like objects. Each
 *   "run" can stage:
 *     - a finishReason (`stop`, `suspended`, etc.)
 *     - an optional suspendPayload (shape harness reads in _maybeCaptureSuspend)
 *     - an optional `chunks` array used as fullStream contents
 *     - an optional structured `object`
 *     - a runId / text override
 *
 *   Tests can either:
 *     (a) call `enqueueRun({...})` to stage one run per stream/resume call
 *         (used for suspend chains, queue replay, multi-turn flows), or
 *     (b) leave the queue empty and let the agent fall back to its
 *         `defaultOutput`, which is the right ergonomic for one-shot tests.
 *
 *   Every call is recorded so tests can assert the forwarded options
 *   (per-turn mode override, model, abortSignal, etc.).
 */

import { Agent } from '../../../agent';
import type { MastraModelOutput } from '../../../stream/base/output';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MockSuspendPayload {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  suspendPayload?: unknown;
  resumeSchema?: string;
}

/**
 * Shape returned by one stream/generate/resume call. Anything you don't set
 * inherits from the agent's `defaultOutput` (or sane defaults).
 */
export interface MockRunSpec {
  finishReason?: string;
  suspendPayload?: MockSuspendPayload;
  text?: string;
  runId?: string;
  /** Streamed in order from `fullStream` when Session drains. */
  chunks?: unknown[];
  /** For structured-output / `output: schema` paths. */
  object?: unknown;
  /**
   * Hold the run mid-flight: `getFullOutput()` blocks until this promise
   * resolves. Use to observe in-flight state (e.g. `session.isRunning()`),
   * verify abort propagation, or test concurrent calls.
   */
  holdUntil?: Promise<void>;
  /**
   * Optional handler called when the per-run abortSignal aborts. Lets a test
   * race abort against the held promise without polling `signal.aborted`.
   */
  onAbort?: (reason: unknown) => void;
}

export interface MockStreamCall {
  type: 'stream' | 'generate';
  messages: unknown;
  options: any;
}

export interface MockResumeCall {
  resumeData: unknown;
  options: { runId?: string; toolCallId?: string; abortSignal?: AbortSignal };
}

export interface MockAgentOptions {
  /** Agent id + name. Defaults to `'mock'`. */
  id?: string;
  /** Used when `runs` is empty. Tweak fields to override. */
  defaultOutput?: Partial<MockRunSpec>;
}

// ---------------------------------------------------------------------------
// MockAgent
// ---------------------------------------------------------------------------

/**
 * A duck-typed Agent that backs harness v1 tests. Use in place of a real Agent
 * wherever the harness only cares about the `stream` / `generate` /
 * `resumeStream` surface.
 */
export class MockAgent extends Agent<any, any, any> {
  /** Each entry is consumed in order by stream() / resumeStream() / generate(). */
  runs: MockRunSpec[] = [];
  streamCalls: MockStreamCall[] = [];
  resumeCalls: MockResumeCall[] = [];

  private readonly defaultRun: MockRunSpec;

  constructor(opts: MockAgentOptions = {}) {
    const id = opts.id ?? 'mock';
    super({
      id,
      name: id,
      instructions: 'mock',
      // The model never gets called — Session uses agent.stream/generate
      // directly. The string just satisfies AgentConfig's required shape.
      model: 'openai/gpt-4o-mini' as any,
    });
    this.defaultRun = {
      finishReason: 'stop',
      text: 'ok',
      runId: 'mock-run',
      chunks: [],
      ...opts.defaultOutput,
    };
  }

  /** Push a run that will be returned by the next stream/resumeStream/generate. */
  enqueueRun(spec: MockRunSpec = {}): void {
    this.runs.push(spec);
  }

  /** Convenience: enqueue many at once. */
  enqueueRuns(specs: MockRunSpec[]): void {
    for (const s of specs) this.runs.push(s);
  }

  // -------------------------------------------------------------------------
  // Agent overrides
  // -------------------------------------------------------------------------

  async stream(messages: any, options?: any): Promise<any> {
    this.streamCalls.push({ type: 'stream', messages, options });
    // Honour the runtime-allocated runId when the agent layer passes one
    // (e.g. sendSignal idle-wake). Real Agent.stream() does the same — the
    // runId on the resulting MastraModelOutput matches what the runtime
    // reserved before invoking stream(). Tests that script a specific
    // runId via `defaultOutput`/`addRun` only "win" when the caller did
    // not pass an explicit runId.
    const spec = this.consumeRun();
    if (options?.runId) {
      spec.runId = options.runId;
    }
    const out = this.buildOutput(spec, options?.abortSignal);
    // Register with the thread stream runtime so subscribeToThread / sendSignal
    // consumers see this run's chunks. Real Agent.stream() does the same at the
    // tail of its execution loop; MockAgent overrides stream() without calling
    // super, so we register explicitly here.
    this._internalRegisterStreamRun(out, (options ?? {}) as any);
    return out;
  }

  async generate(messages: any, options?: any): Promise<any> {
    this.streamCalls.push({ type: 'generate', messages, options });
    const out = this.buildOutput(this.consumeRun(), options?.abortSignal);
    return await out.getFullOutput();
  }

  async resumeStream(resumeData: any, options?: any): Promise<any> {
    this.resumeCalls.push({ resumeData, options });
    const spec = this.consumeRun();
    if (options?.runId) {
      spec.runId = options.runId;
    }
    const out = this.buildOutput(spec, options?.abortSignal);
    this._internalRegisterStreamRun(out, (options ?? {}) as any);
    return out;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** Drain one queued run, falling back to `defaultRun` when empty. */
  private consumeRun(): MockRunSpec {
    return this.runs.shift() ?? { ...this.defaultRun };
  }

  private buildOutput(spec: MockRunSpec, abortSignal?: AbortSignal): MastraModelOutput {
    const merged: Required<Pick<MockRunSpec, 'finishReason' | 'text' | 'runId'>> & MockRunSpec = {
      finishReason: spec.finishReason ?? this.defaultRun.finishReason ?? 'stop',
      text: spec.text ?? this.defaultRun.text ?? '',
      runId: spec.runId ?? this.defaultRun.runId ?? 'mock-run',
      chunks: spec.chunks ?? this.defaultRun.chunks ?? [],
      object: spec.object ?? this.defaultRun.object,
      suspendPayload: spec.suspendPayload,
    };

    const fullOutput = {
      text: merged.text,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      finishReason: merged.finishReason,
      object: merged.object,
      steps: [],
      warnings: [],
      providerMetadata: undefined,
      request: {},
      reasoning: [],
      reasoningText: undefined,
      toolCalls: [],
      toolResults: [],
      sources: [],
      files: [],
      response: {
        id: 'r',
        timestamp: new Date(),
        modelId: this.id,
        messages: [],
        uiMessages: [],
      },
      totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      error: undefined,
      tripwire: undefined,
      traceId: undefined,
      spanId: undefined,
      runId: merged.runId,
      suspendPayload: merged.suspendPayload,
      messages: [],
      rememberedMessages: [],
    };

    const chunks = merged.chunks ?? [];
    let finishedResolve!: () => void;
    const finishedPromise = new Promise<void>(resolve => {
      finishedResolve = resolve;
    });
    let status: 'running' | 'finished' = 'running';
    const fullStream = (async function* () {
      for (const chunk of chunks) yield chunk;
      // If a test asked us to hold the run mid-flight, keep the stream
      // suspended before the terminal chunk so the runtime continues to
      // report this run as active (e.g. `subscription.activeRunId()` stays
      // truthy). The hold loses to abort: an aborted per-turn signal
      // unblocks immediately.
      if (spec.holdUntil) {
        await new Promise<void>(resolve => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
          };
          if (abortSignal) {
            if (abortSignal.aborted) return finish();
            abortSignal.addEventListener('abort', finish, { once: true });
          }
          spec.holdUntil!.then(finish, finish);
        });
      }
      // Emit a synthetic finish chunk so subscription drain loops see a run
      // boundary. Real MastraModelOutput emits 'finish' / 'error' / 'abort' /
      // 'tool-call-suspended' at the tail of fullStream; MockAgent stages
      // arbitrary chunks but tests rarely include a terminal one.
      yield {
        type: spec.suspendPayload ? 'tool-call-suspended' : 'finish',
        runId: merged.runId,
        ...(spec.suspendPayload ? { payload: spec.suspendPayload } : {}),
        finishReason: merged.finishReason,
      } as any;
      status = 'finished';
      finishedResolve();
    })();

    // Wire abort → onAbort handler so tests can observe propagation.
    if (abortSignal && spec.onAbort) {
      if (abortSignal.aborted) {
        spec.onAbort((abortSignal as { reason?: unknown }).reason);
      } else {
        abortSignal.addEventListener('abort', () => spec.onAbort!((abortSignal as { reason?: unknown }).reason), {
          once: true,
        });
      }
    }

    // If a test asked us to hold the run mid-flight, `getFullOutput` blocks
    // on `holdUntil`. The hold loses to abort: aborting the per-turn signal
    // unblocks `getFullOutput` with a finishReason='aborted' result.
    const getFullOutput = async () => {
      if (spec.holdUntil) {
        if (abortSignal) {
          await new Promise<void>((resolve, reject) => {
            let settled = false;
            const onAbort = () => {
              if (settled) return;
              settled = true;
              reject(new Error(String((abortSignal as { reason?: unknown }).reason ?? 'aborted')));
            };
            if (abortSignal.aborted) return onAbort();
            abortSignal.addEventListener('abort', onAbort, { once: true });
            spec.holdUntil!.then(
              () => {
                if (settled) return;
                settled = true;
                abortSignal.removeEventListener('abort', onAbort);
                resolve();
              },
              err => {
                if (settled) return;
                settled = true;
                abortSignal.removeEventListener('abort', onAbort);
                reject(err);
              },
            );
          }).catch(err => {
            // Surface abort as a clean finishReason='aborted' result rather
            // than a thrown error, so the harness path mirrors a real agent
            // that catches its own abort.
            fullOutput.finishReason = 'aborted';
            fullOutput.error = err;
          });
        } else {
          await spec.holdUntil;
        }
      }
      return fullOutput;
    };

    const wrappedGetFullOutput = async () => {
      const result = await getFullOutput();
      status = 'finished';
      finishedResolve();
      return result;
    };

    return {
      runId: merged.runId,
      getFullOutput: wrappedGetFullOutput,
      fullStream,
      text: Promise.resolve(fullOutput.text),
      finishReason: Promise.resolve(fullOutput.finishReason),
      usage: Promise.resolve(fullOutput.usage),
      object: Promise.resolve(fullOutput.object),
      get status() {
        return status;
      },
      // Thread-stream-runtime calls this to know when to drop the run record
      // from #threadRunsById and drain pending signals.
      _waitUntilFinished: () => finishedPromise,
    } as unknown as MastraModelOutput;
  }
}
