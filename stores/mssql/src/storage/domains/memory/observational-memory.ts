import { createHash } from 'node:crypto';
import {
  assertActiveObservationsApplied,
  isAppendOnlySince,
  isBufferedChunkCoveredByCursor,
  isBufferedReflectionUnchangedSince,
  maxObservationCursor,
  planReflectionGenerationText,
  withBufferedReflectionVerified,
} from '@internal/core/memory';
import type { UpdateActiveObservationsResult, UpdateBufferedObservationsResult } from '@internal/core/memory';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, TABLE_OBSERVATIONAL_MEMORY } from '@mastra/core/storage';
import type {
  BufferedObservationChunk,
  CreateObservationalMemoryInput,
  CreateReflectionGenerationInput,
  ObservationalMemoryHistoryOptions,
  ObservationalMemoryRecord,
  SwapBufferedReflectionToActiveInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  UpdateBufferedReflectionInput,
  UpdateObservationalMemoryConfigInput,
} from '@mastra/core/storage';
import sql from 'mssql';
import { getSchemaName, getTableName } from '../utils';

/** Canonical head order: newest generation, then earliest createdAt, then lowest id. */
const OM_HEAD_ORDER = '[generationCount] DESC, [createdAt] ASC, [id] ASC';
/** Max `supersededBy` hops when redirecting a write aimed at a retired record. */
const OM_MAX_HEAD_HOPS = 3;
/** Attempts for an OM transaction chosen as a deadlock victim or timed out on a lock. */
const OM_MAX_TRANSACTION_ATTEMPTS = 3;
/** How long initialization waits for the per-key application lock. */
const OM_INIT_LOCK_TIMEOUT_MS = 30_000;

/** Deadlock victim (1205) or lock request timeout (1222): the statement can be retried. */
const ERR_DEADLOCK_VICTIM = 1205;
const ERR_LOCK_TIMEOUT = 1222;

/** Case- and accent-sensitive comparison, so a group id search matches the literal text. */
const BINARY_COLLATION = 'Latin1_General_100_BIN2';

/** Locks the primary-key row for the rest of the transaction; other writers queue behind it. */
const ROW_LOCK = 'WITH (UPDLOCK, ROWLOCK, HOLDLOCK)';

const ID_TYPE = () => sql.NVarChar(255);
const KEY_TYPE = () => sql.NVarChar(450);
const TEXT_TYPE = () => sql.NVarChar(sql.MAX);
const DATE_TYPE = () => sql.DateTime2(7);

type OMRow = Record<string, any>;

function isRetryableLockError(error: unknown): boolean {
  const number = (error as { number?: number } | null)?.number;
  return number === ERR_DEADLOCK_VICTIM || number === ERR_LOCK_TIMEOUT;
}

function rethrowOrWrap(error: unknown, operation: string, details: Record<string, any>): never {
  if (error instanceof MastraError) throw error;
  throw new MastraError(
    {
      id: createStorageErrorId('MSSQL', operation, 'FAILED'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      details,
    },
    error,
  );
}

function throwNotFound(id: string, operation: string): never {
  throw new MastraError({
    id: createStorageErrorId('MSSQL', operation, 'NOT_FOUND'),
    text: `Observational memory record not found: ${id}`,
    domain: ErrorDomain.STORAGE,
    category: ErrorCategory.THIRD_PARTY,
    details: { id },
  });
}

function parseJSONColumn<T>(value: unknown): T | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'string') return JSON.parse(value) as T;
  return value as T;
}

function parseBufferedChunks(raw: unknown): BufferedObservationChunk[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toDate(value: unknown): Date | undefined {
  if (value === null || value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function getObservationalMemoryKey(threadId: string | null, resourceId: string): string {
  return threadId ? `thread:${threadId}` : `resource:${resourceId}`;
}

export interface MssqlObservationalMemoryConfig {
  pool: sql.ConnectionPool;
  schema?: string;
  /** Checks the run fence in scope for the owning store, inside the write's transaction. */
  assertFence: (transaction: sql.Transaction, operation: string) => Promise<void>;
}

/**
 * Observational memory lifecycle on SQL Server.
 *
 * Every lifecycle write runs in one transaction that row-locks its target record by primary key
 * (`UPDLOCK, ROWLOCK, HOLDLOCK`), re-reads the stored state under that lock, and returns the real
 * outcome. A record retired by a reflection keeps a `supersededBy` pointer to its successor, so a
 * write aimed at it either reports `retired` or is redirected to the live head. Initialization is
 * serialized per key by a transaction-owned application lock, because there is no row to lock
 * before the first record exists.
 */
export class MssqlObservationalMemory {
  readonly #pool: sql.ConnectionPool;
  readonly #schema?: string;
  readonly #table: string;
  readonly #assertFence: MssqlObservationalMemoryConfig['assertFence'];

  constructor({ pool, schema, assertFence }: MssqlObservationalMemoryConfig) {
    this.#pool = pool;
    this.#schema = schema;
    this.#table = getTableName({ indexName: TABLE_OBSERVATIONAL_MEMORY, schemaName: getSchemaName(schema) });
    this.#assertFence = assertFence;
  }

  async getObservationalMemory(threadId: string | null, resourceId: string): Promise<ObservationalMemoryRecord | null> {
    try {
      const result = await this.#pool
        .request()
        .input('lookupKey', KEY_TYPE(), getObservationalMemoryKey(threadId, resourceId))
        .query(`SELECT TOP 1 * FROM ${this.#table} WHERE [lookupKey] = @lookupKey ORDER BY ${OM_HEAD_ORDER}`);
      const row = result.recordset[0];
      return row ? this.#parseRow(row) : null;
    } catch (error) {
      rethrowOrWrap(error, 'GET_OBSERVATIONAL_MEMORY', { threadId, resourceId });
    }
  }

  async getObservationalMemoryHistory(
    threadId: string | null,
    resourceId: string,
    limit: number = 10,
    options?: ObservationalMemoryHistoryOptions,
  ): Promise<ObservationalMemoryRecord[]> {
    try {
      const request = this.#pool
        .request()
        .input('lookupKey', KEY_TYPE(), getObservationalMemoryKey(threadId, resourceId));
      const conditions = ['[lookupKey] = @lookupKey'];

      if (options?.recordId !== undefined) {
        conditions.push('[id] = @recordId');
        request.input('recordId', ID_TYPE(), options.recordId);
      }
      if (options?.from) {
        conditions.push('[createdAt] >= @from');
        request.input('from', DATE_TYPE(), options.from);
      }
      if (options?.to) {
        conditions.push('[createdAt] <= @to');
        request.input('to', DATE_TYPE(), options.to);
      }
      if (options?.groupId !== undefined) {
        // The group's opening tag, matched literally in the active text or in any buffered chunk.
        request.input('groupPrefix', TEXT_TYPE(), `<observation-group id="${options.groupId}"`);
        conditions.push(`(
          CHARINDEX(@groupPrefix COLLATE ${BINARY_COLLATION}, [activeObservations] COLLATE ${BINARY_COLLATION}) > 0
          OR EXISTS (
            SELECT 1 FROM OPENJSON(CASE WHEN ISJSON([bufferedObservationChunks]) = 1 THEN [bufferedObservationChunks] END)
              WITH ([observations] NVARCHAR(MAX) '$.observations') AS chunk
            WHERE CHARINDEX(@groupPrefix COLLATE ${BINARY_COLLATION}, chunk.[observations] COLLATE ${BINARY_COLLATION}) > 0
          )
        )`);
      }
      if (options?.beforeGeneration !== undefined) {
        conditions.push('[generationCount] < @beforeGeneration');
        request.input('beforeGeneration', sql.Int, options.beforeGeneration);
      }
      if (options?.afterGeneration !== undefined) {
        conditions.push('[generationCount] > @afterGeneration');
        request.input('afterGeneration', sql.Int, options.afterGeneration);
      }

      const direction = options?.sortDirection === 'ASC' ? 'ASC' : 'DESC';
      request.input('offset', sql.Int, Math.max(0, Math.floor(Number(options?.offset ?? 0)) || 0));
      request.input('limit', sql.Int, Math.max(1, Math.floor(Number(limit)) || 10));
      const result = await request.query(
        `SELECT * FROM ${this.#table} WHERE ${conditions.join(' AND ')}
         ORDER BY [generationCount] ${direction}, [createdAt] ASC, [id] ASC
         OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      );
      return result.recordset.map(row => this.#parseRow(row));
    } catch (error) {
      rethrowOrWrap(error, 'GET_OBSERVATIONAL_MEMORY_HISTORY', { threadId, resourceId, limit });
    }
  }

  async initializeObservationalMemory(input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
    const lookupKey = getObservationalMemoryKey(input.threadId, input.resourceId);
    try {
      const existing = await this.getObservationalMemory(input.threadId, input.resourceId);
      if (existing) return existing;

      // An application lock owned by the transaction serializes initializers for this key across
      // connections: each re-checks for a live record while holding it, and the insert commits
      // before the lock is released. The resource name is bounded by hashing the key.
      const lockName = `mastra_om_init:${this.#schema ?? 'dbo'}:${createHash('sha256').update(lookupKey).digest('hex')}`;
      await this.#transaction(async transaction => {
        const lock = await transaction
          .request()
          .input('resource', sql.NVarChar(255), lockName)
          .input('timeout', sql.Int, OM_INIT_LOCK_TIMEOUT_MS)
          .query(
            `DECLARE @result INT;
             EXEC @result = sp_getapplock @Resource = @resource, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = @timeout;
             SELECT @result AS result;`,
          );
        const status = Number(lock.recordset[0]?.result);
        if (status < 0) {
          throw new Error(
            `Could not acquire the observational memory initialization lock for ${lookupKey} (sp_getapplock returned ${status})`,
          );
        }

        const live = await transaction
          .request()
          .input('lookupKey', KEY_TYPE(), lookupKey)
          .query(`SELECT TOP 1 [id] FROM ${this.#table} WHERE [lookupKey] = @lookupKey AND [supersededBy] IS NULL`);
        if (live.recordset.length > 0) return;

        const now = new Date();
        await transaction
          .request()
          // Never reused: a write addressed to a cleared record must not land on its successor.
          .input('id', ID_TYPE(), globalThis.crypto.randomUUID())
          .input('lookupKey', KEY_TYPE(), lookupKey)
          .input('scope', sql.NVarChar(400), input.scope)
          .input('resourceId', sql.NVarChar(400), input.resourceId)
          .input('threadId', sql.NVarChar(400), input.threadId || null)
          .input('config', TEXT_TYPE(), JSON.stringify(input.config))
          .input('observedTimezone', sql.NVarChar(400), input.observedTimezone || null)
          .input('now', DATE_TYPE(), now)
          .query(
            `INSERT INTO ${this.#table} (
              [id], [lookupKey], [scope], [resourceId], [threadId], [activeObservations], [originType], [config],
              [generationCount], [pendingMessageTokens], [totalTokensObserved], [observationTokenCount],
              [isObserving], [isReflecting], [isBufferingObservation], [isBufferingReflection], [lastBufferedAtTokens],
              [observedTimezone], [supersededBy], [createdAt], [updatedAt]
            ) VALUES (
              @id, @lookupKey, @scope, @resourceId, @threadId, N'', 'initial', @config,
              0, 0, 0, 0,
              0, 0, 0, 0, 0,
              @observedTimezone, NULL, @now, @now
            )`,
          );
      });

      // Whoever inserted first (this call or a concurrent one), the head is now the answer.
      const head = await this.getObservationalMemory(input.threadId, input.resourceId);
      if (!head) throwNotFound(lookupKey, 'INITIALIZE_OBSERVATIONAL_MEMORY');
      return head;
    } catch (error) {
      rethrowOrWrap(error, 'INITIALIZE_OBSERVATIONAL_MEMORY', {
        threadId: input.threadId,
        resourceId: input.resourceId,
      });
    }
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<void> {
    assertActiveObservationsApplied(await this.commitActiveObservations(input), input.id);
  }

  async commitActiveObservations(input: UpdateActiveObservationsInput): Promise<UpdateActiveObservationsResult> {
    try {
      return await this.#transaction(async transaction => {
        const row = await this.#lockRow(transaction, input.id);
        if (!row) throwNotFound(input.id, 'UPDATE_ACTIVE_OBSERVATIONS');
        if (row.supersededBy) return { applied: false, reason: 'retired' as const };
        if (
          input.expectedActiveObservations !== undefined &&
          input.expectedActiveObservations !== ((row.activeObservations as string) || '')
        ) {
          return { applied: false, reason: 'conflict' as const };
        }

        // The cursor never moves backward.
        const lastObservedAt = maxObservationCursor(toDate(row.lastObservedAt), input.lastObservedAt)!;
        await transaction
          .request()
          .input('observations', TEXT_TYPE(), input.observations)
          .input('lastObservedAt', DATE_TYPE(), lastObservedAt)
          .input('tokenCount', sql.Int, input.tokenCount)
          .input(
            'observedMessageIds',
            TEXT_TYPE(),
            input.observedMessageIds ? JSON.stringify(input.observedMessageIds) : null,
          )
          .input('now', DATE_TYPE(), new Date())
          .input('id', ID_TYPE(), input.id)
          .query(
            `UPDATE ${this.#table} SET
              [activeObservations] = @observations,
              [lastObservedAt] = @lastObservedAt,
              [pendingMessageTokens] = 0,
              [observationTokenCount] = @tokenCount,
              [totalTokensObserved] = [totalTokensObserved] + @tokenCount,
              [observedMessageIds] = @observedMessageIds,
              [updatedAt] = @now
            WHERE [id] = @id`,
          );
        return { applied: true };
      }, 'commitActiveObservations');
    } catch (error) {
      rethrowOrWrap(error, 'UPDATE_ACTIVE_OBSERVATIONS', { id: input.id });
    }
  }

  async createReflectionGeneration(input: CreateReflectionGenerationInput): Promise<ObservationalMemoryRecord> {
    const { currentRecord } = input;
    try {
      return await this.#transaction(async transaction => {
        const row = await this.#lockRow(transaction, currentRecord.id);
        if (!row) return currentRecord;
        // A retired snapshot creates nothing; the caller adopts the head.
        if (row.supersededBy) return this.#parseRow(await this.#resolveLiveRow(transaction, row));
        const stored = this.#parseRow(row);
        const plan = planReflectionGenerationText({
          storedObservations: stored.activeObservations,
          storedObservationTokenCount: stored.observationTokenCount,
          snapshotObservations: currentRecord.activeObservations,
          snapshotObservationTokenCount: currentRecord.observationTokenCount,
          reflection: input.reflection,
          tokenCount: input.tokenCount,
        });
        // The text was rewritten (not only appended to) since the snapshot: the reflection is stale.
        if (!plan) return stored;
        return this.#rollOver(transaction, stored.id, plan.observations, plan.tokenCount, input.newRecordId, false);
      }, 'createReflectionGeneration');
    } catch (error) {
      rethrowOrWrap(error, 'CREATE_REFLECTION_GENERATION', { currentRecordId: currentRecord.id });
    }
  }

  async setReflectingFlag(id: string, isReflecting: boolean): Promise<void> {
    await this.#updateFlag(id, 'isReflecting', isReflecting, 'SET_REFLECTING_FLAG');
  }

  async setObservingFlag(id: string, isObserving: boolean): Promise<void> {
    await this.#updateFlag(id, 'isObserving', isObserving, 'SET_OBSERVING_FLAG');
  }

  async setBufferingReflectionFlag(id: string, isBuffering: boolean): Promise<void> {
    await this.#updateFlag(id, 'isBufferingReflection', isBuffering, 'SET_BUFFERING_REFLECTION_FLAG');
  }

  async setBufferingObservationFlag(id: string, isBuffering: boolean, lastBufferedAtTokens?: number): Promise<void> {
    try {
      await this.#transaction(async transaction => {
        const row = await this.#lockRow(transaction, id);
        if (!row) throwNotFound(id, 'SET_BUFFERING_OBSERVATION_FLAG');
        // A retired id is redirected to the head.
        const target = await this.#resolveLiveRow(transaction, row);
        const request = transaction
          .request()
          .input('isBuffering', sql.Bit, isBuffering)
          .input('now', DATE_TYPE(), new Date())
          .input('id', ID_TYPE(), target.id);
        if (lastBufferedAtTokens !== undefined) request.input('lastBufferedAtTokens', sql.Int, lastBufferedAtTokens);
        await request.query(
          `UPDATE ${this.#table} SET [isBufferingObservation] = @isBuffering,
            ${lastBufferedAtTokens !== undefined ? '[lastBufferedAtTokens] = @lastBufferedAtTokens,' : ''}
            [updatedAt] = @now
          WHERE [id] = @id`,
        );
      });
    } catch (error) {
      rethrowOrWrap(error, 'SET_BUFFERING_OBSERVATION_FLAG', { id });
    }
  }

  async clearObservationalMemory(threadId: string | null, resourceId: string): Promise<void> {
    try {
      await this.#pool
        .request()
        .input('lookupKey', KEY_TYPE(), getObservationalMemoryKey(threadId, resourceId))
        .query(`DELETE FROM ${this.#table} WHERE [lookupKey] = @lookupKey`);
    } catch (error) {
      rethrowOrWrap(error, 'CLEAR_OBSERVATIONAL_MEMORY', { threadId, resourceId });
    }
  }

  async setPendingMessageTokens(id: string, tokenCount: number): Promise<void> {
    try {
      await this.#transaction(async transaction => {
        const row = await this.#lockRow(transaction, id);
        if (!row) throwNotFound(id, 'SET_PENDING_MESSAGE_TOKENS');
        // A retired id is redirected to the head.
        const target = await this.#resolveLiveRow(transaction, row);
        await transaction
          .request()
          .input('tokenCount', sql.Int, tokenCount)
          .input('now', DATE_TYPE(), new Date())
          .input('id', ID_TYPE(), target.id)
          .query(`UPDATE ${this.#table} SET [pendingMessageTokens] = @tokenCount, [updatedAt] = @now WHERE [id] = @id`);
      });
    } catch (error) {
      rethrowOrWrap(error, 'SET_PENDING_MESSAGE_TOKENS', { id });
    }
  }

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<void> {
    await this.appendBufferedObservations(input);
  }

  async appendBufferedObservations(input: UpdateBufferedObservationsInput): Promise<UpdateBufferedObservationsResult> {
    const newChunk: BufferedObservationChunk = {
      id: `ombuf-${globalThis.crypto.randomUUID()}`,
      cycleId: input.chunk.cycleId,
      observations: input.chunk.observations,
      tokenCount: input.chunk.tokenCount,
      messageIds: input.chunk.messageIds,
      messageTokens: input.chunk.messageTokens,
      lastObservedAt: input.chunk.lastObservedAt,
      createdAt: new Date(),
      suggestedContinuation: input.chunk.suggestedContinuation,
      currentTask: input.chunk.currentTask,
      threadTitle: input.chunk.threadTitle,
      extractedValues: input.chunk.extractedValues,
      extractionFailures: input.chunk.extractionFailures,
    };

    try {
      return await this.#transaction(async transaction => {
        const row = await this.#lockRow(transaction, input.id);
        if (!row) throwNotFound(input.id, 'UPDATE_BUFFERED_OBSERVATIONS');
        // A retired id is redirected to the head.
        const target = await this.#resolveLiveRow(transaction, row);
        const existingChunks = parseBufferedChunks(target.bufferedObservationChunks);

        // Skip a retried append (same cycle) and a chunk the cursor already wholly covers.
        if (
          existingChunks.some(existing => existing.cycleId === input.chunk.cycleId) ||
          isBufferedChunkCoveredByCursor(input.chunk.lastObservedAt, toDate(target.lastObservedAt))
        ) {
          return { persisted: false, recordId: target.id as string };
        }

        // lastBufferedAtTime never moves backward.
        const lastBufferedAtTime = maxObservationCursor(
          toDate(target.lastBufferedAtTime),
          input.lastBufferedAtTime ?? undefined,
        );
        await transaction
          .request()
          .input('chunks', TEXT_TYPE(), JSON.stringify([...existingChunks, newChunk]))
          .input('lastBufferedAtTime', DATE_TYPE(), lastBufferedAtTime ?? null)
          .input('now', DATE_TYPE(), new Date())
          .input('id', ID_TYPE(), target.id)
          .query(
            `UPDATE ${this.#table} SET
              [bufferedObservationChunks] = @chunks,
              [lastBufferedAtTime] = @lastBufferedAtTime,
              [updatedAt] = @now
            WHERE [id] = @id`,
          );
        return { persisted: true, recordId: target.id as string };
      }, 'appendBufferedObservations');
    } catch (error) {
      rethrowOrWrap(error, 'UPDATE_BUFFERED_OBSERVATIONS', { id: input.id });
    }
  }

  async swapBufferedToActive(input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
    try {
      return await this.#transaction(async transaction => {
        // Lock the record: activation is computed from (and written back to) the stored state.
        const row = await this.#lockRow(transaction, input.id);
        if (!row) throwNotFound(input.id, 'SWAP_BUFFERED_TO_ACTIVE');

        const emptyResult: SwapBufferedToActiveResult = {
          chunksActivated: 0,
          messageTokensActivated: 0,
          observationTokensActivated: 0,
          messagesActivated: 0,
          activatedCycleIds: [],
          activatedMessageIds: [],
        };
        // A retired record is frozen: activation reports it and writes nothing.
        if (row.supersededBy) return { ...emptyResult, retired: true };

        // Activation always works on the stored list, so a chunk appended after the caller read
        // the record is never dropped. Caller-provided chunks only override token weights.
        const persistedChunks = parseBufferedChunks(row.bufferedObservationChunks);
        const refreshedWeights = new Map(
          (Array.isArray(input.bufferedChunks) ? input.bufferedChunks : []).map(c => [c.id, c.messageTokens]),
        );
        const chunks = persistedChunks.map(c =>
          refreshedWeights.has(c.id) ? { ...c, messageTokens: refreshedWeights.get(c.id)! } : c,
        );
        if (chunks.length === 0) return emptyResult;

        const chunksToActivate = selectActivationBoundary(chunks, input);
        const activatedChunks = chunks.slice(0, chunksToActivate);
        const remainingChunks = persistedChunks.slice(chunksToActivate);

        const activatedContent = activatedChunks.map(c => c.observations).join('\n\n');
        const activatedTokens = activatedChunks.reduce((sum, c) => sum + c.tokenCount, 0);
        const activatedMessageTokens = activatedChunks.reduce((sum, c) => sum + (c.messageTokens ?? 0), 0);
        const activatedMessageCount = activatedChunks.reduce((sum, c) => sum + c.messageIds.length, 0);
        const activatedCycleIds = activatedChunks.map(c => c.cycleId).filter((cid): cid is string => !!cid);
        const activatedMessageIds = activatedChunks.flatMap(c => c.messageIds ?? []);

        // Derive lastObservedAt from the latest activated chunk; the stored cursor never moves
        // backward (a sync observation may already be past this chunk).
        const latestChunk = activatedChunks[activatedChunks.length - 1];
        const derivedLastObservedAt =
          input.lastObservedAt ?? (latestChunk?.lastObservedAt ? new Date(latestChunk.lastObservedAt) : new Date());
        const lastObservedAt = maxObservationCursor(toDate(row.lastObservedAt), derivedLastObservedAt)!;

        const existingActive = (row.activeObservations as string) || '';
        const newActive = existingActive ? `${existingActive}\n\n${activatedContent}` : activatedContent;
        const newTokenCount = Number(row.observationTokenCount || 0) + activatedTokens;
        const newPending = Math.max(0, Number(row.pendingMessageTokens || 0) - activatedMessageTokens);

        await transaction
          .request()
          .input('active', TEXT_TYPE(), newActive)
          .input('tokenCount', sql.Int, newTokenCount)
          .input('pending', sql.Int, newPending)
          .input('chunks', TEXT_TYPE(), remainingChunks.length > 0 ? JSON.stringify(remainingChunks) : null)
          .input('lastObservedAt', DATE_TYPE(), lastObservedAt)
          .input('now', DATE_TYPE(), new Date())
          .input('id', ID_TYPE(), input.id)
          .query(
            `UPDATE ${this.#table} SET
              [activeObservations] = @active,
              [observationTokenCount] = @tokenCount,
              [pendingMessageTokens] = @pending,
              [bufferedObservationChunks] = @chunks,
              [lastObservedAt] = @lastObservedAt,
              [updatedAt] = @now
            WHERE [id] = @id`,
          );

        return {
          chunksActivated: activatedChunks.length,
          messageTokensActivated: activatedMessageTokens,
          observationTokensActivated: activatedTokens,
          messagesActivated: activatedMessageCount,
          activatedCycleIds,
          activatedMessageIds,
          observations: activatedContent,
          perChunk: activatedChunks.map(c => ({
            cycleId: c.cycleId ?? '',
            messageTokens: c.messageTokens ?? 0,
            observationTokens: c.tokenCount,
            messageCount: c.messageIds.length,
            observations: c.observations,
          })),
          suggestedContinuation: latestChunk?.suggestedContinuation ?? undefined,
          currentTask: latestChunk?.currentTask ?? undefined,
        };
      }, 'swapBufferedToActive');
    } catch (error) {
      rethrowOrWrap(error, 'SWAP_BUFFERED_TO_ACTIVE', { id: input.id });
    }
  }

  async updateBufferedReflection(input: UpdateBufferedReflectionInput): Promise<void> {
    try {
      await this.#transaction(async transaction => {
        const result = await transaction
          .request()
          .input('reflection', TEXT_TYPE(), input.reflection)
          .input('tokenCount', sql.Int, input.tokenCount)
          .input('inputTokenCount', sql.Int, input.inputTokenCount)
          .input('lineCount', sql.Int, input.reflectedObservationLineCount)
          .input('now', DATE_TYPE(), new Date())
          .input('id', ID_TYPE(), input.id)
          .query(
            `UPDATE ${this.#table} SET
              [bufferedReflection] = CASE
                WHEN [bufferedReflection] IS NOT NULL AND [bufferedReflection] <> N''
                THEN CONCAT([bufferedReflection], NCHAR(10), NCHAR(10), @reflection)
                ELSE @reflection
              END,
              [bufferedReflectionTokens] = COALESCE([bufferedReflectionTokens], 0) + @tokenCount,
              [bufferedReflectionInputTokens] = COALESCE([bufferedReflectionInputTokens], 0) + @inputTokenCount,
              [reflectedObservationLineCount] = @lineCount,
              [updatedAt] = @now
            WHERE [id] = @id`,
          );
        if (result.rowsAffected[0] === 0) throwNotFound(input.id, 'UPDATE_BUFFERED_REFLECTION');
      }, 'updateBufferedReflection');
    } catch (error) {
      rethrowOrWrap(error, 'UPDATE_BUFFERED_REFLECTION', { id: input.id });
    }
  }

  async swapBufferedReflectionToActive(input: SwapBufferedReflectionToActiveInput): Promise<ObservationalMemoryRecord> {
    const { currentRecord } = input;
    try {
      return await this.#transaction(async transaction => {
        const row = await this.#lockRow(transaction, currentRecord.id);
        if (!row) return currentRecord;
        // A retired snapshot creates nothing; the caller adopts the head.
        if (row.supersededBy) return this.#parseRow(await this.#resolveLiveRow(transaction, row));
        const stored = this.#parseRow(row);

        const bufferedReflection = stored.bufferedReflection || '';
        if (!bufferedReflection) {
          throw new MastraError({
            id: createStorageErrorId('MSSQL', 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'NO_CONTENT'),
            text: 'No buffered reflection to swap',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { id: currentRecord.id },
          });
        }
        // Only appends may have happened since the caller's snapshot; a rewrite invalidates the
        // reflected line count.
        if (!isAppendOnlySince(stored.activeObservations, currentRecord.activeObservations)) {
          return stored;
        }
        // The swap must consume the buffer and reflected line count the caller read; another
        // writer may have extended both since, which the activated text alone cannot reveal.
        if (!isBufferedReflectionUnchangedSince(stored, currentRecord)) {
          return stored;
        }

        // Lines 0..reflectedLineCount were reflected on and are replaced by the buffered
        // reflection; lines added after reflection started are kept as-is.
        const reflectedLineCount = stored.reflectedObservationLineCount ?? 0;
        const unreflectedContent = (stored.activeObservations || '')
          .split('\n')
          .slice(reflectedLineCount)
          .join('\n')
          .trim();
        const newObservations = unreflectedContent
          ? `${bufferedReflection}\n\n${unreflectedContent}`
          : bufferedReflection;
        // tokenCount is computed by the processor from its snapshot; add tokens appended since.
        const tokenCount =
          input.tokenCount +
          Math.max(0, (stored.observationTokenCount ?? 0) - (currentRecord.observationTokenCount ?? 0));

        const successor = await this.#rollOver(
          transaction,
          stored.id,
          newObservations,
          tokenCount,
          input.newRecordId,
          true,
        );
        return withBufferedReflectionVerified(successor, currentRecord);
      }, 'swapBufferedReflectionToActive');
    } catch (error) {
      rethrowOrWrap(error, 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', { id: currentRecord.id });
    }
  }

  /** Inserts a fully formed record, e.g. the copy a thread clone carries over. */
  async insertObservationalMemoryRecord(record: ObservationalMemoryRecord): Promise<void> {
    try {
      await this.#pool
        .request()
        .input('id', ID_TYPE(), record.id)
        .input('lookupKey', KEY_TYPE(), getObservationalMemoryKey(record.threadId, record.resourceId))
        .input('scope', sql.NVarChar(400), record.scope)
        .input('resourceId', sql.NVarChar(400), record.resourceId)
        .input('threadId', sql.NVarChar(400), record.threadId || null)
        .input('activeObservations', TEXT_TYPE(), record.activeObservations || '')
        .input('originType', sql.NVarChar(400), record.originType || 'initial')
        .input('config', TEXT_TYPE(), JSON.stringify(record.config ?? {}))
        .input('generationCount', sql.Int, record.generationCount || 0)
        .input('lastObservedAt', DATE_TYPE(), record.lastObservedAt ?? null)
        .input('pendingMessageTokens', sql.Int, record.pendingMessageTokens || 0)
        .input('totalTokensObserved', sql.Int, record.totalTokensObserved || 0)
        .input('observationTokenCount', sql.Int, record.observationTokenCount || 0)
        .input(
          'observedMessageIds',
          TEXT_TYPE(),
          record.observedMessageIds ? JSON.stringify(record.observedMessageIds) : null,
        )
        .input(
          'chunks',
          TEXT_TYPE(),
          record.bufferedObservationChunks?.length ? JSON.stringify(record.bufferedObservationChunks) : null,
        )
        .input('bufferedReflection', TEXT_TYPE(), record.bufferedReflection || null)
        .input('bufferedReflectionTokens', sql.Int, record.bufferedReflectionTokens ?? null)
        .input('bufferedReflectionInputTokens', sql.Int, record.bufferedReflectionInputTokens ?? null)
        .input('reflectedObservationLineCount', sql.Int, record.reflectedObservationLineCount ?? null)
        .input('isObserving', sql.Bit, !!record.isObserving)
        .input('isReflecting', sql.Bit, !!record.isReflecting)
        .input('isBufferingObservation', sql.Bit, !!record.isBufferingObservation)
        .input('isBufferingReflection', sql.Bit, !!record.isBufferingReflection)
        .input('lastBufferedAtTokens', sql.Int, record.lastBufferedAtTokens || 0)
        .input('lastBufferedAtTime', DATE_TYPE(), record.lastBufferedAtTime ?? null)
        .input('observedTimezone', sql.NVarChar(400), record.observedTimezone || null)
        .input('metadata', TEXT_TYPE(), record.metadata ? JSON.stringify(record.metadata) : null)
        .input('supersededBy', ID_TYPE(), record.supersededBy ?? null)
        .input('createdAt', DATE_TYPE(), record.createdAt)
        .input('updatedAt', DATE_TYPE(), record.updatedAt)
        .query(
          `INSERT INTO ${this.#table} (
            [id], [lookupKey], [scope], [resourceId], [threadId], [activeObservations], [originType], [config],
            [generationCount], [lastObservedAt], [pendingMessageTokens], [totalTokensObserved], [observationTokenCount],
            [observedMessageIds], [bufferedObservationChunks], [bufferedReflection], [bufferedReflectionTokens],
            [bufferedReflectionInputTokens], [reflectedObservationLineCount],
            [isObserving], [isReflecting], [isBufferingObservation], [isBufferingReflection],
            [lastBufferedAtTokens], [lastBufferedAtTime], [observedTimezone], [metadata], [supersededBy],
            [createdAt], [updatedAt]
          ) VALUES (
            @id, @lookupKey, @scope, @resourceId, @threadId, @activeObservations, @originType, @config,
            @generationCount, @lastObservedAt, @pendingMessageTokens, @totalTokensObserved, @observationTokenCount,
            @observedMessageIds, @chunks, @bufferedReflection, @bufferedReflectionTokens,
            @bufferedReflectionInputTokens, @reflectedObservationLineCount,
            @isObserving, @isReflecting, @isBufferingObservation, @isBufferingReflection,
            @lastBufferedAtTokens, @lastBufferedAtTime, @observedTimezone, @metadata, @supersededBy,
            @createdAt, @updatedAt
          )`,
        );
    } catch (error) {
      rethrowOrWrap(error, 'INSERT_OBSERVATIONAL_MEMORY_RECORD', { id: record.id });
    }
  }

  /** Deep-merges `input.config` into the stored config under a row lock, so concurrent updates both land. */
  async updateObservationalMemoryConfig(
    input: UpdateObservationalMemoryConfigInput,
    merge: (target: Record<string, unknown>, source: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.#transaction(async transaction => {
        const row = await this.#lockRow(transaction, input.id);
        if (!row) throwNotFound(input.id, 'UPDATE_OM_CONFIG');
        const merged = merge(parseJSONColumn<Record<string, unknown>>(row.config) ?? {}, input.config);
        await transaction
          .request()
          .input('config', TEXT_TYPE(), JSON.stringify(merged))
          .input('now', DATE_TYPE(), new Date())
          .input('id', ID_TYPE(), input.id)
          .query(`UPDATE ${this.#table} SET [config] = @config, [updatedAt] = @now WHERE [id] = @id`);
      });
    } catch (error) {
      rethrowOrWrap(error, 'UPDATE_OM_CONFIG', { id: input.id });
    }
  }

  /**
   * Runs `fn` in one transaction, after checking the run fence when `fencedOperation` is given.
   * A deadlock victim or lock timeout is retried a bounded number of times; the server has
   * already rolled the transaction back.
   */
  async #transaction<T>(fn: (transaction: sql.Transaction) => Promise<T>, fencedOperation?: string): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const transaction = this.#pool.transaction();
      await transaction.begin();
      try {
        if (fencedOperation) await this.#assertFence(transaction, fencedOperation);
        const result = await fn(transaction);
        await transaction.commit();
        return result;
      } catch (error) {
        await transaction.rollback().catch(() => {});
        if (attempt < OM_MAX_TRANSACTION_ATTEMPTS && isRetryableLockError(error)) continue;
        throw error;
      }
    }
  }

  /** Row-locks one record by primary key for the rest of the transaction. */
  async #lockRow(transaction: sql.Transaction, id: string): Promise<OMRow | null> {
    const result = await transaction
      .request()
      .input('id', ID_TYPE(), id)
      .query(`SELECT * FROM ${this.#table} ${ROW_LOCK} WHERE [id] = @id`);
    return result.recordset[0] ?? null;
  }

  /**
   * The live, row-locked record a write aimed at `row` lands on: `row` itself while live,
   * otherwise the head. The head is found with a plain canonical read, then locked by primary
   * key; a head retired in between is followed through `supersededBy` (bounded).
   */
  async #resolveLiveRow(transaction: sql.Transaction, row: OMRow): Promise<OMRow> {
    if (!row.supersededBy) return row;
    const heads = await transaction
      .request()
      .input('lookupKey', KEY_TYPE(), row.lookupKey)
      .query(`SELECT TOP 1 [id] FROM ${this.#table} WHERE [lookupKey] = @lookupKey ORDER BY ${OM_HEAD_ORDER}`);
    const headId = (heads.recordset[0]?.id as string | undefined) ?? (row.supersededBy as string);
    let current: OMRow = (await this.#lockRow(transaction, headId)) ?? row;
    for (let hop = 0; current.supersededBy; hop++) {
      const next = hop < OM_MAX_HEAD_HOPS ? await this.#lockRow(transaction, current.supersededBy as string) : null;
      if (!next) {
        throw new MastraError({
          id: createStorageErrorId('MSSQL', 'RESOLVE_OBSERVATIONAL_MEMORY_HEAD', 'FAILED'),
          text: `Observational memory record ${row.id} is superseded but no live head was found`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: row.id as string },
        });
      }
      current = next;
    }
    return current;
  }

  /**
   * Creates the next generation from the stored (live, row-locked) record and retires the stored
   * record in the same transaction. Carried columns are copied in SQL from the stored row:
   * buffered chunks move to the new generation; the cursor, buffering markers, pending tokens and
   * counters carry over; buffered reflection state does not (and is cleared on the retired row
   * after a buffered swap).
   */
  async #rollOver(
    transaction: sql.Transaction,
    storedId: string,
    observations: string,
    tokenCount: number,
    newRecordId: string | undefined,
    clearBufferedReflection: boolean,
  ): Promise<ObservationalMemoryRecord> {
    const id = newRecordId ?? globalThis.crypto.randomUUID();
    const now = new Date();
    await transaction
      .request()
      .input('id', ID_TYPE(), id)
      .input('observations', TEXT_TYPE(), observations)
      .input('tokenCount', sql.Int, Math.round(tokenCount))
      .input('now', DATE_TYPE(), now)
      .input('storedId', ID_TYPE(), storedId)
      .query(
        `INSERT INTO ${this.#table} (
          [id], [lookupKey], [scope], [resourceId], [threadId],
          [activeObservations], [activeObservationsPendingUpdate],
          [originType], [config], [generationCount], [lastObservedAt], [lastReflectionAt],
          [pendingMessageTokens], [totalTokensObserved], [observationTokenCount], [bufferedObservationChunks],
          [isObserving], [isReflecting], [isBufferingObservation], [isBufferingReflection],
          [lastBufferedAtTokens], [lastBufferedAtTime],
          [observedTimezone], [metadata], [supersededBy], [createdAt], [updatedAt]
        )
        SELECT
          @id, [lookupKey], [scope], [resourceId], [threadId],
          @observations, NULL,
          'reflection', [config], [generationCount] + 1, [lastObservedAt], @now,
          [pendingMessageTokens], [totalTokensObserved], @tokenCount, [bufferedObservationChunks],
          0, 0, [isBufferingObservation], 0,
          [lastBufferedAtTokens], [lastBufferedAtTime],
          [observedTimezone], [metadata], NULL, @now, @now
        FROM ${this.#table} WHERE [id] = @storedId`,
      );

    // Retire the stored record: chunks moved, liveness marker set (never cleared).
    const retired = await transaction
      .request()
      .input('id', ID_TYPE(), id)
      .input('now', DATE_TYPE(), now)
      .input('storedId', ID_TYPE(), storedId)
      .query(
        `UPDATE ${this.#table} SET
          [supersededBy] = @id,
          [bufferedObservationChunks] = NULL,
          ${
            clearBufferedReflection
              ? `[bufferedReflection] = NULL, [bufferedReflectionTokens] = NULL,
          [bufferedReflectionInputTokens] = NULL, [reflectedObservationLineCount] = NULL,`
              : ''
          }
          [updatedAt] = @now
        WHERE [id] = @storedId AND [supersededBy] IS NULL`,
      );
    if (retired.rowsAffected[0] !== 1) {
      throw new MastraError({
        id: createStorageErrorId('MSSQL', 'CREATE_REFLECTION_GENERATION', 'RETIRE_FAILED'),
        text: `Failed to retire observational memory record ${storedId}`,
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: { id: storedId },
      });
    }

    const inserted = await this.#lockRow(transaction, id);
    if (!inserted) throwNotFound(id, 'CREATE_REFLECTION_GENERATION');
    return this.#parseRow(inserted);
  }

  async #updateFlag(id: string, column: string, value: boolean, operation: string): Promise<void> {
    try {
      const result = await this.#pool
        .request()
        .input('value', sql.Bit, value)
        .input('now', DATE_TYPE(), new Date())
        .input('id', ID_TYPE(), id)
        .query(`UPDATE ${this.#table} SET [${column}] = @value, [updatedAt] = @now WHERE [id] = @id`);
      if (result.rowsAffected[0] === 0) throwNotFound(id, operation);
    } catch (error) {
      rethrowOrWrap(error, operation, { id });
    }
  }

  #parseRow(row: OMRow): ObservationalMemoryRecord {
    return {
      id: row.id,
      scope: row.scope,
      threadId: row.threadId || null,
      resourceId: row.resourceId,
      createdAt: toDate(row.createdAt) ?? new Date(),
      updatedAt: toDate(row.updatedAt) ?? new Date(),
      lastObservedAt: toDate(row.lastObservedAt),
      originType: row.originType || 'initial',
      generationCount: Number(row.generationCount || 0),
      activeObservations: row.activeObservations || '',
      bufferedObservationChunks: parseJSONColumn<BufferedObservationChunk[]>(row.bufferedObservationChunks),
      bufferedObservations: row.activeObservationsPendingUpdate || undefined,
      bufferedObservationTokens: row.bufferedObservationTokens ? Number(row.bufferedObservationTokens) : undefined,
      bufferedMessageIds: undefined,
      bufferedReflection: row.bufferedReflection || undefined,
      bufferedReflectionTokens: row.bufferedReflectionTokens ? Number(row.bufferedReflectionTokens) : undefined,
      bufferedReflectionInputTokens: row.bufferedReflectionInputTokens
        ? Number(row.bufferedReflectionInputTokens)
        : undefined,
      reflectedObservationLineCount: row.reflectedObservationLineCount
        ? Number(row.reflectedObservationLineCount)
        : undefined,
      totalTokensObserved: Number(row.totalTokensObserved || 0),
      observationTokenCount: Number(row.observationTokenCount || 0),
      pendingMessageTokens: Number(row.pendingMessageTokens || 0),
      isReflecting: !!row.isReflecting,
      isObserving: !!row.isObserving,
      isBufferingObservation: !!row.isBufferingObservation,
      isBufferingReflection: !!row.isBufferingReflection,
      lastBufferedAtTokens: Number(row.lastBufferedAtTokens || 0),
      lastBufferedAtTime: toDate(row.lastBufferedAtTime) ?? null,
      config: parseJSONColumn(row.config) ?? {},
      metadata: parseJSONColumn(row.metadata),
      observedMessageIds: parseJSONColumn<string[]>(row.observedMessageIds),
      observedTimezone: row.observedTimezone || undefined,
      supersededBy: row.supersededBy ?? null,
    };
  }
}

/**
 * How many leading chunks to activate: the chunk boundary closest to the activation target that
 * still leaves the retention floor of message tokens pending.
 */
function selectActivationBoundary(chunks: BufferedObservationChunk[], input: SwapBufferedToActiveInput): number {
  const retentionFloor = input.messageTokensThreshold * (1 - input.activationRatio);
  const targetMessageTokens = Math.max(0, input.currentPendingTokens - retentionFloor);

  let cumulativeMessageTokens = 0;
  let bestOverBoundary = 0;
  let bestOverTokens = 0;
  let bestUnderBoundary = 0;
  let bestUnderTokens = 0;

  for (let i = 0; i < chunks.length; i++) {
    cumulativeMessageTokens += chunks[i]!.messageTokens ?? 0;
    const boundary = i + 1;
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

  if (input.forceMaxActivation && bestOverBoundary > 0 && remainingAfterOver >= minRemaining) return bestOverBoundary;
  if (bestOverBoundary > 0 && overshoot <= maxOvershoot && remainingAfterOver >= minRemaining) return bestOverBoundary;
  if (bestUnderBoundary > 0 && remainingAfterUnder >= minRemaining) return bestUnderBoundary;
  if (bestOverBoundary > 0) return bestOverBoundary;
  return 1;
}
