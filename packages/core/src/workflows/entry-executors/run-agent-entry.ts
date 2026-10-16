import type { ReadableStream } from 'node:stream/web';
import { TripWire } from '../../agent/trip-wire';
import { isDurableAgentLike } from '../../agent/types';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { PubSub } from '../../events';
import type { Mastra } from '../../mastra';
import { resolveObservabilityContext } from '../../observability';
import type { ChunkType } from '../../stream/types';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '../constants';
import { forwardAgentStreamChunk } from '../stream-utils';
import type { AgentStepEntry } from '../types';
import { resolveEntryActor } from './actor';
import type { EntryExecuteContext } from './types';

/**
 * Returns the runtime registered for `agent` on `mastra`. Registering a
 * `durable: true` agent stores a durable wrapper instead of the original, so a
 * step holding the original must run through that wrapper. Only agents built
 * with `durable` are swapped: an explicit `createDurableAgent({ agent })` leaves
 * the plain handle plain. Matching is by identity of the wrapped agent, so
 * unrelated agents sharing an id are ignored.
 */
export function resolveRegisteredAgent<T>(agent: T, mastra?: Mastra): T {
  const candidate = agent as { durable?: unknown; id?: string; getMastraInstance?: () => Mastra | undefined };
  if (!candidate?.durable) return agent;
  // Already a durable wrapper (e.g. a Proxy that forwards `durable` to its inner agent).
  if (isDurableAgentLike(agent)) {
    const inner: unknown = agent.agent;
    if (inner !== agent) return agent;
  }

  for (const registered of Object.values(mastra?.listAgents?.() ?? {})) {
    if (registered !== agent && isDurableAgentLike(registered) && registered.agent === agent) {
      return registered as T;
    }
  }

  // Attached to a Mastra the original skips its standalone durable path, so
  // without a wrapper on this Mastra it runs non-durably.
  const owner = candidate.getMastraInstance?.();
  if (owner) {
    (mastra ?? owner)
      .getLogger()
      ?.warn(
        `Agent "${candidate.id}" has durable enabled but no durable wrapper for it is registered on this workflow's Mastra instance, so the step runs it non-durably. Register the agent in the \`agents\` of the Mastra instance that runs this workflow.`,
      );
  }
  return agent;
}

/**
 * Returns the agent to run through `streamLegacy()`. v1 models have no durable
 * execution path, and a durable wrapper's inherited `streamLegacy()` would skip
 * the wrapped agent's own config (processors, memory, tools), so a wrapper is
 * unwrapped to the agent it wraps. Warns because the step runs non-durably.
 */
export function resolveLegacyAgent<T>(agent: T, mastra?: Mastra): T {
  if (!isDurableAgentLike(agent)) return agent;
  mastra
    ?.getLogger()
    ?.warn(
      `Agent "${agent.id}" is durable but uses a legacy v1 model, which has no durable execution path, so the step runs it non-durably.`,
    );
  const inner: unknown = agent.agent;
  return (inner !== agent ? inner : agent) as T;
}

/**
 * Runs a declarative `agent` entry: resolves the agent (inline handle, else the
 * Mastra registry), streams the prompt through it, forwards stream chunks, and
 * returns either the structured output or `{ text }`.
 *
 * `ctx` is the step execute context (the same object a plain step's `execute`
 * receives). `mastra` defaults to `ctx.mastra` when omitted.
 */
export async function runAgentEntry(
  entry: AgentStepEntry,
  ctx: EntryExecuteContext,
  mastra?: Mastra,
): Promise<unknown> {
  const registry = mastra ?? (ctx?.mastra as Mastra | undefined);
  const agent = entry.agent ? resolveRegisteredAgent(entry.agent, registry) : registry?.getAgentById(entry.agentId);
  if (!agent) {
    throw new Error(
      `Agent '${entry.agentId}' not found for workflow step '${entry.id}'. Register the agent on the Mastra instance or pass the agent instance directly.`,
    );
  }

  // `retries` / `scorers` / `metadata` are step-level concerns handled by the
  // engine (see getEntryRetries); everything else is passed to the agent run.
  const { retries: _retries, scorers: _scorers, metadata: _metadata, ...agentOptions } = (entry.options ?? {}) as any;

  const {
    inputData,
    runId,
    [PUBSUB_SYMBOL]: pubsub,
    [STREAM_FORMAT_SYMBOL]: streamFormat,
    requestContext,
    actor,
    abortSignal,
    abort,
    writer,
    ...rest
  } = ctx;
  const observabilityContext = resolveObservabilityContext(rest);
  const resolvedActor = resolveEntryActor(agentOptions, actor);
  let streamPromise = {} as {
    promise: Promise<string>;
    resolve: (value: string) => void;
    reject: (reason?: any) => void;
  };

  streamPromise.promise = new Promise((resolve, reject) => {
    streamPromise.resolve = resolve;
    streamPromise.reject = reject;
  });
  // The promise is awaited later (and sometimes not at all when structured
  // output short-circuits); attach a no-op handler so an early rejection
  // can't surface as an unhandled rejection before the await.
  streamPromise.promise.catch(() => {});

  // Track structured output result
  let structuredResult: any = null;
  // Distinguishes "no object produced" from a validly-parsed falsy object
  // (e.g. `0`/`false`/`""` for primitive-root schemas) at the return site.
  let structuredResultProduced = false;
  // Retained for diagnostics when the structured-output guard fires.
  let finishResult: any = undefined;

  const toolData = {
    name: agent.name,
    args: inputData,
  };

  let stream: ReadableStream<any>;

  const handleFinish = (result: any) => {
    const resultWithObject = result as typeof result & { object?: unknown };
    finishResult = result;
    if (agentOptions?.structuredOutput?.schema && resultWithObject.object !== undefined) {
      structuredResult = resultWithObject.object;
      structuredResultProduced = true;
    }
    streamPromise.resolve(result.text);
    void agentOptions?.onFinish?.(result);
  };

  let cleanup: (() => void) | undefined;

  try {
    if (
      (await agent.getModel({ requestContext })).specificationVersion === 'v1' &&
      typeof agent.streamLegacy === 'function'
    ) {
      const legacyAgent = resolveLegacyAgent(agent, registry);
      const { fullStream } = await legacyAgent.streamLegacy((inputData as { prompt: string }).prompt, {
        ...agentOptions,
        requestContext,
        actor: resolvedActor,
        ...observabilityContext,
        onFinish: handleFinish,
        abortSignal,
      });
      stream = fullStream as any;
    } else {
      const streamResult = await agent.stream((inputData as { prompt: string }).prompt, {
        ...agentOptions,
        requestContext,
        actor: resolvedActor,
        ...observabilityContext,
        onFinish: handleFinish,
        abortSignal,
      });
      const isDurableStreamResult =
        typeof streamResult.cleanup === 'function' && streamResult.output && typeof streamResult.output === 'object';
      const modelOutput = isDurableStreamResult ? streamResult.output : streamResult;
      cleanup = isDurableStreamResult ? streamResult.cleanup : undefined;

      // handleFinish (the agent's onFinish) is the sole source of truth for the
      // final text — the success side of .text is intentionally a no-op.
      // `modelOutput.text` can resolve with '' if a downstream output-processor
      // throws inside the base output's try/catch (see output.ts:970-973,978-981)
      // and it fires BEFORE handleFinish, so racing here would poison
      // streamPromise. Only the rejection channel below is wired up so genuine
      // stream errors still propagate.
      void modelOutput.text.then(
        () => {},
        (err: unknown) => streamPromise.reject(err),
      );
      stream = modelOutput.fullStream as ReadableStream<ChunkType>;
    }

    const tripwireChunk =
      streamFormat === 'legacy'
        ? await bridgeLegacyWatchEvents({ stream, pubsub, runId, toolData })
        : await consumeStreamForTripwire(stream, writer);

    // If a tripwire was detected, throw TripWire to abort the workflow step
    if (tripwireChunk) {
      throw new TripWire(
        tripwireChunk.payload?.reason || 'Agent tripwire triggered',
        {
          retry: tripwireChunk.payload?.retry,
          metadata: tripwireChunk.payload?.metadata,
        },
        tripwireChunk.payload?.processorId,
      );
    }

    if (abortSignal.aborted) {
      return abort();
    }

    // A step that declared a structured-output schema but finished without an
    // object must fail closed rather than silently returning `{ text }` as
    // success. Reuse STRUCTURED_OUTPUT_OBJECT_UNDEFINED so this matches what
    // isStructuredOutputFormatError already recognises across the agent stack.
    if (agentOptions?.structuredOutput?.schema && !structuredResultProduced) {
      throw new MastraError({
        id: 'STRUCTURED_OUTPUT_OBJECT_UNDEFINED',
        domain: ErrorDomain.MASTRA_WORKFLOW,
        category: ErrorCategory.USER,
        text: `Agent step '${entry.id}' declared structuredOutput.schema but the agent finished without producing an object.`,
        details: {
          stepId: entry.id,
          finishReason: finishResult?.finishReason ?? 'unknown',
          usage: finishResult?.usage,
        },
      });
    }

    // Return structured output if available, otherwise default text
    if (structuredResultProduced) {
      return structuredResult;
    }
    return {
      text: await streamPromise.promise,
    };
  } finally {
    cleanup?.();
  }
}

/**
 * Legacy-format watch-event bridge: instead of forwarding chunks to the step
 * writer, mirrors the agent stream onto the run's pubsub watch channel as
 * `tool-call-streaming-*` / `tool-call-delta` events (the shape v1 watchers
 * expect). Returns the tripwire chunk if one was seen, else `null`.
 */
async function bridgeLegacyWatchEvents({
  stream,
  pubsub,
  runId,
  toolData,
}: {
  stream: ReadableStream<any>;
  pubsub: PubSub;
  runId: string;
  toolData: { name: string; args: unknown };
}): Promise<any> {
  let tripwireChunk: any = null;
  await pubsub.publish(`workflow.events.v2.${runId}`, {
    type: 'watch',
    runId,
    data: { type: 'tool-call-streaming-start', ...(toolData ?? {}) },
  });
  try {
    for await (const chunk of stream) {
      if (chunk.type === 'tripwire') {
        tripwireChunk = chunk;
        break;
      }
      if (chunk.type === 'text-delta') {
        await pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: { type: 'tool-call-delta', ...(toolData ?? {}), argsTextDelta: chunk.textDelta },
        });
      }
    }
  } finally {
    // Watchers pair streaming-start with streaming-finish; publish it even
    // when iteration throws or breaks early so they never hang open. Swallow
    // publish failures here so they can't mask the original error.
    await pubsub
      .publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: { type: 'tool-call-streaming-finish', ...(toolData ?? {}) },
      })
      .catch(() => {});
  }
  return tripwireChunk;
}

/**
 * Forwards every chunk to the step writer, stopping early when a tripwire
 * chunk appears. Returns the tripwire chunk if one was seen, else `null`.
 */
async function consumeStreamForTripwire(
  stream: ReadableStream<any>,
  writer: EntryExecuteContext['writer'],
): Promise<any> {
  for await (const chunk of stream) {
    await forwardAgentStreamChunk({ writer, chunk });
    if (chunk.type === 'tripwire') {
      return chunk;
    }
  }
  return null;
}
