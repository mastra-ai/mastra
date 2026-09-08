import type { MessageList } from '../../../agent/message-list';
import type { TripWireOptions } from '../../../agent/trip-wire';
import type { ObservabilityContext } from '../../../observability';
import type { ProcessorState, ProcessorStreamWriter } from '../../../processors';
import type { ProcessorRunner } from '../../../processors/runner';
import type { RequestContext } from '../../../request-context';
import type { ChunkType } from '../../../stream/types';

export interface ProcessChunkDeps<OUTPUT = undefined> {
  /**
   * Pre-built runner sharing the run's processor states. `undefined` means no
   * output processors are configured (main: none passed to the loop; durable:
   * registry entry is empty after a process hop, so the live processor
   * instances are unavailable) — the chunk is emitted unprocessed.
   */
  runner: ProcessorRunner | undefined;
  processorStates: Map<string, ProcessorState<OUTPUT>> | undefined;
  observabilityContext?: ObservabilityContext;
  requestContext?: RequestContext;
  messageList?: MessageList;
  /** Writer for processor-emitted custom chunks (routed to the engine's stream). */
  streamWriter?: ProcessorStreamWriter;
  /**
   * Engine emission hook: main enqueues on the request-scoped stream
   * controller; durable publishes via pubsub (no-op when pubsub is absent).
   */
  emitChunk: (chunk: ChunkType<OUTPUT>) => void | Promise<void>;
  /**
   * Processor-failure policy (deliberate engine difference, not drift). When
   * omitted, processor errors propagate and fail the step — in main the run
   * and stream share a request lifecycle, so the client sees the failure.
   * Durable supplies warn-and-return-original: a streaming-side problem must
   * not kill a potentially long-lived workflow run. (Ledger: returning the
   * original chunk leaks the unprocessed value past a throwing redaction
   * processor — to be fixed deliberately with its own test.)
   *
   * The returned chunk (if any) is emitted in place of the processed one,
   * unless the processed chunk already reached the stream — then it is
   * returned as-is and nothing further is emitted.
   */
  onProcessorError?: (error: unknown, originalChunk: ChunkType<OUTPUT>) => ChunkType<OUTPUT> | null;
  /**
   * Durable-only: the finish chunk that normally tears down stream-processor
   * spans never reaches this pipeline, so spans opened for this chunk are
   * ended right after processing. Main's spans end via the finish chunk in
   * the inner stream pipeline that shares the same processor states.
   */
  endSpansAfterProcessing?: boolean;
}

/**
 * Shared per-chunk output-processor pipeline (PHASE3 Step 5): run a
 * tool-shaped chunk through the run's output processors, emit the processed
 * chunk (or a tripwire when blocked), then drain any parts a processor
 * stashed for reprocessing (e.g. the non-text part that triggered a
 * BatchPartsProcessor flush), pushing each back through the whole chain.
 *
 * Returns the processed chunk, or `null` if it was blocked by a processor
 * (a tripwire chunk is emitted instead).
 *
 * Adjudications:
 * - `drainReprocessParts` (previously main-only, added a month after the
 *   durable engine forked): stashed parts were silently dropped on the
 *   durable engine; both engines now drain.
 * - Error policy stays per-engine via `onProcessorError` (see the hook doc).
 */
export async function processAndEmitChunk<OUTPUT = undefined>(
  chunk: ChunkType<OUTPUT>,
  deps: ProcessChunkDeps<OUTPUT>,
): Promise<ChunkType<OUTPUT> | null> {
  const { runner, processorStates } = deps;

  if (!runner || !processorStates) {
    await deps.emitChunk(chunk);
    return chunk;
  }

  const emitTripwire = async (reason?: string, opts?: TripWireOptions<unknown>, processorId?: string) => {
    await deps.emitChunk({
      type: 'tripwire',
      payload: {
        reason: reason || 'Output processor blocked content',
        retry: opts?.retry,
        metadata: opts?.metadata,
        processorId,
      },
    } as ChunkType<OUTPUT>);
  };

  let emitted: ChunkType<OUTPUT> | null = null;
  try {
    const {
      part: processed,
      blocked,
      reason,
      tripwireOptions,
      processorId,
    } = await runner.processPart(
      chunk,
      processorStates,
      deps.observabilityContext,
      deps.requestContext,
      deps.messageList,
      0,
      deps.streamWriter,
    );

    if (blocked) {
      // Emit a tripwire chunk so downstream knows about the block
      await emitTripwire(reason, tripwireOptions, processorId);
      return null;
    }

    if (processed) {
      await deps.emitChunk(processed);
      emitted = processed;
    }

    // Emit any parts a processor stashed for reprocessing, pushing each back
    // through the whole chain so it gets downstream processing.
    const reprocessed = await runner.drainReprocessParts(
      processorStates,
      deps.observabilityContext,
      deps.requestContext,
      deps.messageList,
      0,
      deps.streamWriter,
    );
    for (const r of reprocessed) {
      if (r.blocked) {
        await emitTripwire(r.reason, r.tripwireOptions, r.processorId);
        return emitted;
      }
      if (r.part != null) {
        await deps.emitChunk(r.part);
      }
    }

    return emitted;
  } catch (error) {
    if (!deps.onProcessorError) {
      throw error;
    }
    const fallback = deps.onProcessorError(error, chunk);
    if (emitted) {
      // The processed chunk already reached the stream — don't emit again.
      return emitted;
    }
    if (fallback != null) {
      await deps.emitChunk(fallback);
    }
    return fallback;
  } finally {
    if (deps.endSpansAfterProcessing) {
      runner.endStreamProcessorSpans(processorStates);
    }
  }
}
