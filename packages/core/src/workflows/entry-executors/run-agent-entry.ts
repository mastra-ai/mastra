import type { ReadableStream } from 'node:stream/web';
import { TripWire } from '../../agent/trip-wire';
import type { PubSub } from '../../events';
import type { Mastra } from '../../mastra';
import { resolveObservabilityContext } from '../../observability';
import type { ChunkType } from '../../stream/types';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '../constants';
import { forwardAgentStreamChunk } from '../stream-utils';
import type { AgentStepEntry } from '../types';
import type { EntryExecuteContext } from './types';

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
  const agent = entry.agent ?? registry?.getAgentById(entry.agentId);
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
    abortSignal,
    abort,
    writer,
    ...rest
  } = ctx;
  const observabilityContext = resolveObservabilityContext(rest);
  let streamPromise = {} as {
    promise: Promise<string>;
    resolve: (value: string) => void;
    reject: (reason?: any) => void;
  };

  streamPromise.promise = new Promise((resolve, reject) => {
    streamPromise.resolve = resolve;
    streamPromise.reject = reject;
  });

  // Track structured output result
  let structuredResult: any = null;

  const toolData = {
    name: agent.name,
    args: inputData,
  };

  let stream: ReadableStream<any>;

  const handleFinish = (result: any) => {
    const resultWithObject = result as typeof result & { object?: unknown };
    if (agentOptions?.structuredOutput?.schema && resultWithObject.object) {
      structuredResult = resultWithObject.object;
    }
    streamPromise.resolve(result.text);
    void agentOptions?.onFinish?.(result);
  };

  if (
    (await agent.getModel({ requestContext })).specificationVersion === 'v1' &&
    typeof agent.streamLegacy === 'function'
  ) {
    const { fullStream } = await agent.streamLegacy((inputData as { prompt: string }).prompt, {
      ...agentOptions,
      requestContext,
      ...observabilityContext,
      onFinish: handleFinish,
      abortSignal,
    });
    stream = fullStream as any;
  } else {
    const modelOutput = await agent.stream((inputData as { prompt: string }).prompt, {
      ...agentOptions,
      requestContext,
      ...observabilityContext,
      onFinish: handleFinish,
      abortSignal,
    });

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

  // Return structured output if available, otherwise default text
  if (structuredResult !== null) {
    return structuredResult;
  }
  return {
    text: await streamPromise.promise,
  };
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
  await pubsub.publish(`workflow.events.v2.${runId}`, {
    type: 'watch',
    runId,
    data: { type: 'tool-call-streaming-finish', ...(toolData ?? {}) },
  });
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
