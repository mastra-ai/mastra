import { randomUUID } from 'node:crypto';

import { ErrorCategory, MastraError } from '@mastra/core/error';
import { TABLE_OBSERVATIONAL_MEMORY } from '@mastra/core/storage';
import type {
  BufferedObservationChunk,
  ObservationalMemoryRecord,
  SwapBufferedReflectionToActiveInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  UpdateBufferedObservationsInput,
  UpdateBufferedReflectionInput,
} from '@mastra/core/storage';
import type { Connection } from 'oracledb';

import { asBindParameters, executeOptions, nullableClobBind, nullableJsonBind, rows } from '../../../shared/connection';
import type { ObjectRow } from '../../../shared/connection';
import { toDate } from '../../domain-utils';
import { insertOMRecord, omSelect, parseOMRow } from './observational';
import type { ObservationalMemoryRow } from './observational';
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
import { assertRowsAffected, numberOrZero, parseBufferedChunks, storageError, stringOrEmpty, table } from './utils';
import type { MemoryContext } from './utils';

// Async buffering/reflection workflow: observations and reflections generated
// off the hot path accumulate here before being swapped into active state.
// Depends on observational.ts for the row shape, SELECT clause, and insert helper.

export async function updateBufferedObservations(ctx: MemoryContext, input: UpdateBufferedObservationsInput): Promise<void> {
  try {
    await ctx.db.tx(async (_client, connection) => {
      const row = await lockOMRow(ctx, connection, input.id, 'UPDATE_BUFFERED_OBSERVATIONS');
      const existingChunks = parseBufferedChunks(row.bufferedObservationChunks);
      // Buffer chunks let long observation cycles append safely without
      // rewriting the active observation CLOB on every small update.
      const newChunk: BufferedObservationChunk = {
        id: `ombuf-${randomUUID()}`,
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
      const updatedChunks = [...existingChunks, newChunk];
      const lastBufferedAtTimeSql =
        input.lastBufferedAtTime === undefined || input.lastBufferedAtTime === null
          ? ''
          : `,\n               ${OM_LAST_BUFFERED_AT_TIME} = :lastBufferedAtTime`;
      const binds: Record<string, unknown> = {
        id: input.id,
        bufferedObservationChunks: nullableJsonBind(updatedChunks),
        updatedAt: new Date(),
      };
      if (input.lastBufferedAtTime !== undefined && input.lastBufferedAtTime !== null) {
        binds.lastBufferedAtTime = toDate(input.lastBufferedAtTime);
      }

      const result = await connection.execute(
        `UPDATE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
           SET ${OM_BUFFERED_OBSERVATION_CHUNKS} = :bufferedObservationChunks,
               ${OM_UPDATED_AT} = :updatedAt${lastBufferedAtTimeSql}
           WHERE id = :id`,
        asBindParameters(binds),
      );
      assertRowsAffected(result.rowsAffected, 'UPDATE_BUFFERED_OBSERVATIONS', input.id);
    });
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('UPDATE_BUFFERED_OBSERVATIONS', 'FAILED', { id: input.id }, error);
  }
}

export async function swapBufferedToActive(ctx: MemoryContext, input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
  try {
    return await ctx.db.tx(async (_client, connection) => {
      const row = await lockOMRow(ctx, connection, input.id, 'SWAP_BUFFERED_TO_ACTIVE');
      const chunks = input.bufferedChunks?.length ? input.bufferedChunks : parseBufferedChunks(row.bufferedObservationChunks);

      if (chunks.length === 0) {
        return emptySwapResult();
      }

      const activation = calculateBufferedActivation(chunks, input);
      const lastObservedAt =
        input.lastObservedAt ??
        (activation.activatedChunks.at(-1)?.lastObservedAt
          ? toDate(activation.activatedChunks.at(-1)!.lastObservedAt)
          : new Date());
      const boundary = `\n\n--- message boundary (${lastObservedAt.toISOString()}) ---\n\n`;
      // Keep each activated chunk readable inside one CLOB while preserving the observation timestamp boundary.
      const existingActive = stringOrEmpty(row.activeObservations);
      const newActive = existingActive ? `${existingActive}${boundary}${activation.activatedContent}` : activation.activatedContent;
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
          bufferedObservationChunks: nullableJsonBind(activation.remainingChunks.length > 0 ? activation.remainingChunks : null),
          lastObservedAt,
          updatedAt: new Date(),
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

export async function updateBufferedReflection(ctx: MemoryContext, input: UpdateBufferedReflectionInput): Promise<void> {
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
          updatedAt: new Date(),
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
  try {
    return await ctx.db.tx(async (_client, connection) => {
      const row = await lockOMRow(ctx, connection, input.currentRecord.id, 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE');
      const bufferedReflection = stringOrEmpty(row.bufferedReflection);
      if (!bufferedReflection) {
        throw storageError(
          'SWAP_BUFFERED_REFLECTION_TO_ACTIVE',
          'NO_CONTENT',
          { id: input.currentRecord.id },
          new Error('No buffered reflection to swap'),
          ErrorCategory.USER,
        );
      }

      const reflectedLineCount = numberOrZero(row.reflectedObservationLineCount);
      const currentObservations = stringOrEmpty(row.activeObservations);
      // The buffered reflection replaces the lines it summarized, but any
      // observations added after reflection started are preserved below it.
      const unreflectedContent = currentObservations.split('\n').slice(reflectedLineCount).join('\n').trim();
      const newObservations = unreflectedContent ? `${bufferedReflection}\n\n${unreflectedContent}` : bufferedReflection;
      const now = new Date();
      // Derive the carried-over fields from the row we just locked (FOR UPDATE
      // above) instead of input.currentRecord, which can be stale if another
      // writer updated generationCount/config/metadata/etc. concurrently.
      const lockedRecord = parseOMRow(row);
      const newRecord: ObservationalMemoryRecord = {
        id: randomUUID(),
        scope: lockedRecord.scope,
        threadId: lockedRecord.threadId,
        resourceId: lockedRecord.resourceId,
        createdAt: now,
        updatedAt: now,
        lastObservedAt: lockedRecord.lastObservedAt,
        originType: 'reflection',
        generationCount: lockedRecord.generationCount + 1,
        activeObservations: newObservations,
        totalTokensObserved: lockedRecord.totalTokensObserved,
        observationTokenCount: Math.round(input.tokenCount),
        pendingMessageTokens: 0,
        isReflecting: false,
        isObserving: false,
        isBufferingObservation: false,
        isBufferingReflection: false,
        lastBufferedAtTokens: 0,
        lastBufferedAtTime: null,
        config: lockedRecord.config,
        metadata: lockedRecord.metadata,
        observedTimezone: lockedRecord.observedTimezone,
      };

      await insertOMRecord(ctx, connection, newRecord, now);
      const updateResult = await connection.execute(
        `UPDATE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
           SET ${OM_BUFFERED_REFLECTION} = NULL,
               ${OM_BUFFERED_REFLECTION_TOKENS} = NULL,
               ${OM_BUFFERED_REFLECTION_INPUT_TOKENS} = NULL,
               ${OM_REFLECTED_OBSERVATION_LINE_COUNT} = NULL,
               ${OM_UPDATED_AT} = :updatedAt
           WHERE id = :id`,
        { id: input.currentRecord.id, updatedAt: now },
      );
      assertRowsAffected(updateResult.rowsAffected, 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', input.currentRecord.id);

      return newRecord;
    });
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'FAILED', { id: input.currentRecord.id }, error);
  }
}

async function lockOMRow(ctx: MemoryContext, connection: Connection, id: string, operation: string): Promise<ObservationalMemoryRow> {
  // Observational memory updates are incremental and order-sensitive, so
  // mutating paths derive their next state from a locked row.
  const result = await connection.execute<ObjectRow>(
    `${omSelect()} FROM ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)} WHERE id = :id FOR UPDATE`,
    { id },
    executeOptions(),
  );
  const row = rows(result)[0] as ObservationalMemoryRow | undefined;
  if (!row) {
    assertRowsAffected(0, operation, id);
    throw new Error(`Observational memory record not found: ${id}`);
  }
  return row;
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
  const activatedMessageTokens = Math.round(activatedChunks.reduce((sum, chunk) => sum + (chunk.messageTokens ?? 0), 0));
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
