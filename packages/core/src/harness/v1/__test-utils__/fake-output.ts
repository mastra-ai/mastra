import type { MastraModelOutput } from '../../../stream/base/output';

/**
 * Build a minimal duck-typed `MastraModelOutput` for harness v1 tests that
 * use a hand-rolled `FakeAgent` rather than `MockAgent`.
 *
 * The harness's thread-stream subscription drains `output.fullStream` to
 * deliver per-chunk events AND awaits `output._waitUntilFinished()` to
 * settle run completion. Test doubles MUST honor both contracts:
 *
 *   - `fullStream` must be an async iterable that completes (yields zero or
 *     more chunks, then finishes). The drain loop emits harness events from
 *     each chunk.
 *   - `_waitUntilFinished()` must resolve only AFTER `fullStream` has been
 *     fully consumed. The harness's completion watcher resolves the
 *     `_runCompletionPromises` entry on this signal, so resolving early
 *     leaves event subscribers seeing a partial event sequence at the
 *     moment `Session.message()` returns.
 *
 * `getFullOutput()` should be idempotent — return the same bundle whether
 * called by the drain loop or by an outer consumer.
 *
 * @example
 *   const out = buildFakeOutput({
 *     runId: options?.runId ?? 'r1',
 *     fullOutput: { text: 'hi', finishReason: 'stop', ... },
 *     chunks: [],
 *   });
 *   this._internalRegisterStreamRun(out, options);
 *   return out;
 */
export function buildFakeOutput(spec: {
  runId: string;
  /** The bundle returned by `getFullOutput()`. `runId` is auto-stamped onto it. */
  fullOutput: Record<string, unknown>;
  /** Chunks yielded by `fullStream`. Empty array → a stream that completes immediately. */
  chunks?: unknown[];
}): MastraModelOutput {
  const fullOutput = { ...spec.fullOutput, runId: spec.runId };
  const chunks = spec.chunks ?? [];
  let finishedResolve!: () => void;
  const finished = new Promise<void>(r => {
    finishedResolve = r;
  });
  const fullStream = (async function* () {
    try {
      for (const chunk of chunks) yield chunk;
    } finally {
      finishedResolve();
    }
  })();
  return {
    runId: spec.runId,
    getFullOutput: async () => fullOutput,
    fullStream,
    text: Promise.resolve((fullOutput as any).text),
    finishReason: Promise.resolve((fullOutput as any).finishReason),
    usage: Promise.resolve((fullOutput as any).usage),
    _waitUntilFinished: () => finished,
  } as unknown as MastraModelOutput;
}

/**
 * Unwrap the `CreatedAgentSignal` envelope that `Session.message()` hands
 * to `agent.stream()` post-signal-routing. Tests asserting on what was sent
 * to the agent should call this to peel back to the original caller input.
 *
 * If `messages` isn't a created signal (e.g. legacy paths that pass a raw
 * string), it's returned as-is.
 */
export function extractSignalContents(messages: unknown): unknown {
  if (messages && typeof messages === 'object' && (messages as any).__isCreatedSignal) {
    return (messages as any).contents;
  }
  return messages;
}
