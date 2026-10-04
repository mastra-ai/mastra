import { ErrorCategory, MastraError } from '@mastra/core/error';
import {
  TABLE_OBSERVATIONAL_MEMORY,
  isAppendOnlySince,
  isBufferedChunkCoveredByCursor,
  maxObservationCursor,
} from '@mastra/core/storage';
import type {
  BufferedObservationChunk,
  ObservationalMemoryRecord,
  SwapBufferedReflectionToActiveInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  UpdateBufferedObservationsInput,
  UpdateBufferedObservationsResult,
  UpdateBufferedReflectionInput,
} from '@mastra/core/storage';

import { asBindParameters, nullableClobBind, nullableJsonBind } from '../../../shared/connection';
import { toDate } from '../../domain-utils';
import { findOMRowForUpdate, lockOMRow, parseOMRow, resolveLiveOMRow, rollOverOMRow } from './observational';
import {
  OM_ACTIVE_OBSERVATIONS,
  OM_BUFFERED_OBSERVATION_CHUNKS,
  OM_BUFFERED_REFLECTION,
  OM_BUFFERED_REFLECTION_INPUT_TOKENS,
  OM_BUFFERED_REFLECTION_TOKENS,
  OM_LAST_BUFFERED_AT_TIME,
  OM_LAST_OBSERVED_AT,
  OM_OBSERVATION_TOKEN_COUNT,
  OM_PENDING_MESSAGE_TOKENS,
  OM_REFLECTED_OBSERVATION_LINE_COUNT,
  OM_UPDATED_AT,
} from './schema';
import {
  assertRowsAffected,
  numberOrZero,
  parseBufferedChunks,
  storageError,
  stringOrEmpty,
  table,
  timestampBind,
} from './utils';
import type { MemoryContext } from './utils';

// Async buffering/reflection workflow: observations and reflections generated
// off the hot path accumulate here before being swapped into active state.
// Depends on observational.ts for the row shape, SELECT clause, and insert helper.

export async function updateBufferedObservations(
  ctx: MemoryContext,
  input: UpdateBufferedObservationsInput,
): Promise<UpdateBufferedObservationsResult> {
  try {
    return await ctx.db.tx(async (_client, connection) => {
      // A retired id is redirected to the head.
      const row = await resolveLiveOMRow(
        ctx,
        connection,
        await lockOMRow(ctx, connection, input.id, 'UPDATE_BUFFERED_OBSERVATIONS'),
      );
      const existingChunks = parseBufferedChunks(row.bufferedObservationChunks);
      // Skip a retried append (same cycle) and a chunk the cursor already wholly covers.
      if (
        existingChunks.some(existing => existing.cycleId === input.chunk.cycleId) ||
        isBufferedChunkCoveredByCursor(input.chunk.lastObservedAt, row.lastObservedAt)
      ) {
        return { persisted: false, recordId: row.id };
      }
      // Buffer chunks let long observation cycles append safely without
      // rewriting the active observation CLOB on every small update.
      const newChunk: BufferedObservationChunk = {
        id: `ombuf-${globalThis.crypto.randomUUID()}`,
        cycleId: input.chunk.cycleId,
        observations: input.chunk.observations,
        tokenCount: Math.round(input.chunk.tokenCount),
        messageIds: input.chunk.messageIds,
        messageTokens: Math.round(input.chunk.messageTokens ?? 0),
        lastObservedAt: input.chunk.lastObservedAt,
        createdAt: new Date(),
        suggestedContinuation: input.chunk.suggestedContinuation,
        currentTask: input.chunk.currentTask,
        threadTitle: input.chunk.threadTitle,
        extractedValues: input.chunk.extractedValues,
        extractionFailures: input.chunk.extractionFailures,
      };
      // lastBufferedAtTime never moves backward.
      const lastBufferedAtTime = maxObservationCursor(row.lastBufferedAtTime, input.lastBufferedAtTime);
      const result = await connection.execute(
        `UPDATE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
           SET ${OM_BUFFERED_OBSERVATION_CHUNKS} = :bufferedObservationChunks,
               ${OM_LAST_BUFFERED_AT_TIME} = :lastBufferedAtTime,
               ${OM_UPDATED_AT} = :updatedAt
           WHERE id = :id`,
        asBindParameters({
          id: row.id,
          bufferedObservationChunks: nullableJsonBind([...existingChunks, newChunk]),
          lastBufferedAtTime: timestampBind(lastBufferedAtTime),
          updatedAt: timestampBind(new Date()),
        }),
      );
      assertRowsAffected(result.rowsAffected, 'UPDATE_BUFFERED_OBSERVATIONS', row.id);
      return { persisted: true, recordId: row.id };
    });
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('UPDATE_BUFFERED_OBSERVATIONS', 'FAILED', { id: input.id }, error);
  }
}

export async function swapBufferedToActive(
  ctx: MemoryContext,
  input: SwapBufferedToActiveInput,
): Promise<SwapBufferedToActiveResult> {
  try {
    return await ctx.db.tx(async (_client, connection) => {
      const row = await lockOMRow(ctx, connection, input.id, 'SWAP_BUFFERED_TO_ACTIVE');
      // A retired record is frozen: activation reports it and writes nothing.
      if (row.supersededBy) return { ...emptySwapResult(), retired: true };

      // Activation always works on the stored list, so a chunk appended after the caller read
      // the record is never dropped. Caller-provided chunks only override token weights.
      const refreshedWeights = new Map((input.bufferedChunks ?? []).map(chunk => [chunk.id, chunk.messageTokens]));
      const chunks = parseBufferedChunks(row.bufferedObservationChunks).map(chunk => {
        const weight = refreshedWeights.get(chunk.id);
        return weight === undefined ? chunk : { ...chunk, messageTokens: weight };
      });

      if (chunks.length === 0) {
        return emptySwapResult();
      }

      const activation = calculateBufferedActivation(chunks, input);
      const lastObservedAt =
        input.lastObservedAt ??
        (activation.activatedChunks.at(-1)?.lastObservedAt
          ? toDate(activation.activatedChunks.at(-1)!.lastObservedAt)
          : new Date());
      // The stored cursor never moves backward (a sync observation may already be past this chunk).
      const storedCursor = maxObservationCursor(row.lastObservedAt, lastObservedAt);
      const boundary = `\n\n--- message boundary (${lastObservedAt.toISOString()}) ---\n\n`;
      // Keep each activated chunk readable inside one CLOB while preserving the observation timestamp boundary.
      const existingActive = stringOrEmpty(row.activeObservations);
      const newActive = existingActive
        ? `${existingActive}${boundary}${activation.activatedContent}`
        : activation.activatedContent;
      const pendingTokens = Math.max(0, numberOrZero(row.pendingMessageTokens) - activation.activatedMessageTokens);

      const result = await connection.execute(
        `UPDATE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
           SET ${OM_ACTIVE_OBSERVATIONS} = :activeObservations,
               ${OM_OBSERVATION_TOKEN_COUNT} = COALESCE(${OM_OBSERVATION_TOKEN_COUNT}, 0) + :observationTokens,
               ${OM_PENDING_MESSAGE_TOKENS} = :pendingMessageTokens,
               ${OM_BUFFERED_OBSERVATION_CHUNKS} = :bufferedObservationChunks,
               ${OM_LAST_OBSERVED_AT} = :lastObservedAt,
               ${OM_UPDATED_AT} = :updatedAt
           WHERE id = :id`,
        {
          id: input.id,
          activeObservations: nullableClobBind(newActive),
          observationTokens: activation.activatedTokens,
          pendingMessageTokens: pendingTokens,
          bufferedObservationChunks: nullableJsonBind(
            activation.remainingChunks.length > 0 ? activation.remainingChunks : null,
          ),
          lastObservedAt: timestampBind(storedCursor),
          updatedAt: timestampBind(new Date()),
        },
      );
      assertRowsAffected(result.rowsAffected, 'SWAP_BUFFERED_TO_ACTIVE', input.id);

      return activation.result;
    });
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('SWAP_BUFFERED_TO_ACTIVE', 'FAILED', { id: input.id }, error);
  }
}

export async function updateBufferedReflection(
  ctx: MemoryContext,
  input: UpdateBufferedReflectionInput,
): Promise<void> {
  try {
    await ctx.db.tx(async (_client, connection) => {
      const result = await connection.execute(
        `UPDATE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
           SET ${OM_BUFFERED_REFLECTION} = CASE
                 WHEN ${OM_BUFFERED_REFLECTION} IS NOT NULL AND DBMS_LOB.GETLENGTH(${OM_BUFFERED_REFLECTION}) > 0
                 THEN ${OM_BUFFERED_REFLECTION} || CHR(10) || CHR(10) || :reflection
                 ELSE :reflection
               END,
               ${OM_BUFFERED_REFLECTION_TOKENS} = COALESCE(${OM_BUFFERED_REFLECTION_TOKENS}, 0) + :tokenCount,
               ${OM_BUFFERED_REFLECTION_INPUT_TOKENS} = COALESCE(${OM_BUFFERED_REFLECTION_INPUT_TOKENS}, 0) + :inputTokenCount,
               ${OM_REFLECTED_OBSERVATION_LINE_COUNT} = :reflectedObservationLineCount,
               ${OM_UPDATED_AT} = :updatedAt
           WHERE id = :id`,
        {
          id: input.id,
          reflection: nullableClobBind(input.reflection),
          tokenCount: Math.round(input.tokenCount),
          inputTokenCount: Math.round(input.inputTokenCount),
          reflectedObservationLineCount: Math.round(input.reflectedObservationLineCount),
          updatedAt: timestampBind(new Date()),
        },
      );
      assertRowsAffected(result.rowsAffected, 'UPDATE_BUFFERED_REFLECTION', input.id);
    });
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('UPDATE_BUFFERED_REFLECTION', 'FAILED', { id: input.id }, error);
  }
}

export async function swapBufferedReflectionToActive(
  ctx: MemoryContext,
  input: SwapBufferedReflectionToActiveInput,
): Promise<ObservationalMemoryRecord> {
  const { currentRecord } = input;
  try {
    return await ctx.db.tx(async (_client, connection) => {
      const row = await findOMRowForUpdate(ctx, connection, currentRecord.id);
      // Missing target: create nothing.
      if (!row) return currentRecord;
      // A retired snapshot creates nothing; the caller adopts the head.
      if (row.supersededBy) return parseOMRow(await resolveLiveOMRow(ctx, connection, row));

      // Derive everything from the row locked above (FOR UPDATE), not input.currentRecord,
      // which can be stale if another writer updated the record concurrently.
      const stored = parseOMRow(row);
      const bufferedReflection = stored.bufferedReflection ?? '';
      if (!bufferedReflection) {
        throw storageError(
          'SWAP_BUFFERED_REFLECTION_TO_ACTIVE',
          'NO_CONTENT',
          { id: currentRecord.id },
          new Error('No buffered reflection to swap'),
          ErrorCategory.USER,
        );
      }
      // Only appends may have happened since the caller's snapshot; a rewrite invalidates the
      // reflected line count.
      if (!isAppendOnlySince(stored.activeObservations, currentRecord.activeObservations)) {
        return stored;
      }

      const reflectedLineCount = stored.reflectedObservationLineCount ?? 0;
      // The buffered reflection replaces the lines it summarized, but any
      // observations added after reflection started are preserved below it.
      const unreflectedContent = stored.activeObservations.split('\n').slice(reflectedLineCount).join('\n').trim();
      const newObservations = unreflectedContent
        ? `${bufferedReflection}\n\n${unreflectedContent}`
        : bufferedReflection;
      // tokenCount is computed by the processor from its snapshot; add tokens appended since.
      const tokenCount =
        input.tokenCount + Math.max(0, stored.observationTokenCount - (currentRecord.observationTokenCount ?? 0));

      const newRecord = await rollOverOMRow(ctx, connection, stored, newObservations, tokenCount, input.newRecordId);
      const updateResult = await connection.execute(
        `UPDATE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
           SET ${OM_BUFFERED_REFLECTION} = NULL,
               ${OM_BUFFERED_REFLECTION_TOKENS} = NULL,
               ${OM_BUFFERED_REFLECTION_INPUT_TOKENS} = NULL,
               ${OM_REFLECTED_OBSERVATION_LINE_COUNT} = NULL
           WHERE id = :id`,
        { id: stored.id },
      );
      assertRowsAffected(updateResult.rowsAffected, 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', stored.id);
      return newRecord;
    });
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'FAILED', { id: currentRecord.id }, error);
  }
}

function emptySwapResult(): SwapBufferedToActiveResult {
  return {
    chunksActivated: 0,
    messageTokensActivated: 0,
    observationTokensActivated: 0,
    messagesActivated: 0,
    activatedCycleIds: [],
    activatedMessageIds: [],
  };
}

function calculateBufferedActivation(
  chunks: BufferedObservationChunk[],
  input: SwapBufferedToActiveInput,
): {
  activatedChunks: BufferedObservationChunk[];
  remainingChunks: BufferedObservationChunk[];
  activatedContent: string;
  activatedTokens: number;
  activatedMessageTokens: number;
  result: SwapBufferedToActiveResult;
} {
  const retentionFloor = input.messageTokensThreshold * (1 - input.activationRatio);
  const targetMessageTokens = Math.max(0, input.currentPendingTokens - retentionFloor);

  let cumulativeMessageTokens = 0;
  let bestOverBoundary = 0;
  let bestOverTokens = 0;
  let bestUnderBoundary = 0;
  let bestUnderTokens = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    cumulativeMessageTokens += chunks[index]?.messageTokens ?? 0;
    const boundary = index + 1;

    if (cumulativeMessageTokens >= targetMessageTokens) {
      if (bestOverBoundary === 0 || cumulativeMessageTokens < bestOverTokens) {
        bestOverBoundary = boundary;
        bestOverTokens = cumulativeMessageTokens;
      }
    } else if (cumulativeMessageTokens > bestUnderTokens) {
      bestUnderBoundary = boundary;
      bestUnderTokens = cumulativeMessageTokens;
    }
  }

  const maxOvershoot = retentionFloor * 0.95;
  const overshoot = bestOverTokens - targetMessageTokens;
  const remainingAfterOver = input.currentPendingTokens - bestOverTokens;
  const remainingAfterUnder = input.currentPendingTokens - bestUnderTokens;
  const minRemaining = Math.min(1000, retentionFloor);

  let chunksToActivate: number;
  if (input.forceMaxActivation && bestOverBoundary > 0 && remainingAfterOver >= minRemaining) {
    chunksToActivate = bestOverBoundary;
  } else if (bestOverBoundary > 0 && overshoot <= maxOvershoot && remainingAfterOver >= minRemaining) {
    chunksToActivate = bestOverBoundary;
  } else if (bestUnderBoundary > 0 && remainingAfterUnder >= minRemaining) {
    chunksToActivate = bestUnderBoundary;
  } else if (bestOverBoundary > 0) {
    chunksToActivate = bestOverBoundary;
  } else {
    chunksToActivate = 1;
  }

  const activatedChunks = chunks.slice(0, chunksToActivate);
  const remainingChunks = chunks.slice(chunksToActivate);
  const activatedContent = activatedChunks.map(chunk => chunk.observations).join('\n\n');
  const activatedTokens = Math.round(activatedChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0));
  const activatedMessageTokens = Math.round(
    activatedChunks.reduce((sum, chunk) => sum + (chunk.messageTokens ?? 0), 0),
  );
  const activatedMessageIds = activatedChunks.flatMap(chunk => chunk.messageIds ?? []);
  const latestChunkHints = activatedChunks.at(-1);

  return {
    activatedChunks,
    remainingChunks,
    activatedContent,
    activatedTokens,
    activatedMessageTokens,
    result: {
      chunksActivated: activatedChunks.length,
      messageTokensActivated: activatedMessageTokens,
      observationTokensActivated: activatedTokens,
      messagesActivated: activatedChunks.reduce((sum, chunk) => sum + (chunk.messageIds?.length ?? 0), 0),
      activatedCycleIds: activatedChunks.map(chunk => chunk.cycleId).filter(Boolean),
      activatedMessageIds,
      observations: activatedContent,
      perChunk: activatedChunks.map(chunk => ({
        cycleId: chunk.cycleId ?? '',
        messageTokens: chunk.messageTokens ?? 0,
        observationTokens: chunk.tokenCount,
        messageCount: chunk.messageIds?.length ?? 0,
        observations: chunk.observations,
      })),
      suggestedContinuation: latestChunkHints?.suggestedContinuation,
      currentTask: latestChunkHints?.currentTask,
    },
  };
}
