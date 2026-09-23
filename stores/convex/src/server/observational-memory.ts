/**
 * Server-side observational memory operations for the generic Convex storage
 * mutation. All read-modify-write logic lives here so each operation is atomic
 * (Convex mutations are serializable transactions).
 *
 * Logic mirrors @mastra/core's in-memory reference implementation
 * (packages/core/src/storage/domains/memory/inmemory.ts) and the MongoDB
 * adapter. Pure helpers are exported for unit testing.
 *
 * This module is bundled into the user's Convex deployment: no Node.js APIs
 * and no value imports from @mastra/core.
 */
import type { GenericMutationCtx as MutationCtx } from 'convex/server';

import type { SerializedOMChunk, StorageRequest, StorageResponse } from '../storage/types';

type OMRequest = Extract<
  StorageRequest,
  {
    op:
      | 'omGetLatest'
      | 'omGetHistory'
      | 'omUpdateActive'
      | 'omAppendBufferedChunk'
      | 'omSwapBuffered'
      | 'omUpdateBufferedReflection'
      | 'omSwapBufferedReflection'
      | 'omUpdateConfig'
      | 'omCreateReflectionGeneration'
      | 'omCreateArchiveGeneration'
      | 'omListArchives'
      | 'omGetArchive'
      | 'omGetArchivesByGroupIds'
      | 'omClearBufferedReflection';
  }
>;

const OM_QUERY_MAX_DOCS = 10000;

/**
 * Parse the stored bufferedObservationChunks JSON string. Tolerates null,
 * missing, and malformed values by returning an empty array.
 */
export function parseStoredChunks(value: unknown): SerializedOMChunk[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Select how many buffered chunks to activate.
 *
 * Finds the chunk boundary closest to the activation target, biased over
 * (prefer removing slightly more than the target so remaining context lands at
 * or below the retention floor), with an overshoot safeguard that falls back
 * to the best under boundary. Ported from the core in-memory reference.
 */
export function selectActivationBoundary(
  chunks: Array<{ messageTokens?: number }>,
  opts: {
    activationRatio: number;
    messageTokensThreshold: number;
    currentPendingTokens: number;
    forceMaxActivation?: boolean;
  },
): number {
  // Calculate target: how many message tokens to remove so that
  // (1 - activationRatio) * threshold worth of raw messages remain.
  // e.g., ratio=0.8, threshold=5000, pending=6000 → remove 6000 - 1000 = 5000
  const retentionFloor = opts.messageTokensThreshold * (1 - opts.activationRatio);
  const targetMessageTokens = Math.max(0, opts.currentPendingTokens - retentionFloor);

  // Track both best-over and best-under boundaries so we can fall back to
  // under if the over boundary would overshoot by too much.
  let cumulativeMessageTokens = 0;
  let bestOverBoundary = 0;
  let bestOverTokens = 0;
  let bestUnderBoundary = 0;
  let bestUnderTokens = 0;

  for (let i = 0; i < chunks.length; i++) {
    cumulativeMessageTokens += chunks[i]!.messageTokens ?? 0;
    const boundary = i + 1;

    if (cumulativeMessageTokens >= targetMessageTokens) {
      // Over or equal — track the closest (lowest) over boundary
      if (bestOverBoundary === 0 || cumulativeMessageTokens < bestOverTokens) {
        bestOverBoundary = boundary;
        bestOverTokens = cumulativeMessageTokens;
      }
    } else {
      // Under — track the closest (highest) under boundary
      if (cumulativeMessageTokens > bestUnderTokens) {
        bestUnderBoundary = boundary;
        bestUnderTokens = cumulativeMessageTokens;
      }
    }
  }

  // Safeguard: if the over boundary would eat into more than 95% of the
  // retention floor, fall back to the best under boundary instead.
  // When forceMaxActivation is set (above blockAfter), still prefer the over
  // boundary, but never if it would leave fewer than the smaller of 1000
  // tokens or the retention floor remaining.
  const maxOvershoot = retentionFloor * 0.95;
  const overshoot = bestOverTokens - targetMessageTokens;
  const remainingAfterOver = opts.currentPendingTokens - bestOverTokens;
  const remainingAfterUnder = opts.currentPendingTokens - bestUnderTokens;
  // When activationRatio ≈ 1.0, retentionFloor is 0 and minRemaining becomes 0 — intentional for "activate everything" configs.
  const minRemaining = Math.min(1000, retentionFloor);

  if (opts.forceMaxActivation && bestOverBoundary > 0 && remainingAfterOver >= minRemaining) {
    return bestOverBoundary;
  }
  if (bestOverBoundary > 0 && overshoot <= maxOvershoot && remainingAfterOver >= minRemaining) {
    return bestOverBoundary;
  }
  if (bestUnderBoundary > 0 && remainingAfterUnder >= minRemaining) {
    return bestUnderBoundary;
  }
  if (bestOverBoundary > 0) {
    // All boundaries are over and exceed the safeguard — still activate
    // the closest over boundary (better than nothing)
    return bestOverBoundary;
  }
  return 1;
}

/**
 * Merge a buffered reflection with the observations added after the reflection
 * started. Lines 0..reflectedLineCount of activeObservations were reflected on
 * and are replaced by the reflection; later lines are appended as-is.
 */
export function mergeReflectionWithUnreflected(
  activeObservations: string,
  bufferedReflection: string,
  reflectedLineCount: number,
): string {
  const allLines = (activeObservations || '').split('\n');
  const unreflectedLines = allLines.slice(reflectedLineCount);
  const unreflectedContent = unreflectedLines.join('\n').trim();
  return unreflectedContent ? `${bufferedReflection}\n\n${unreflectedContent}` : bufferedReflection;
}

function isPlainObj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep-merge two plain config objects (source wins; undefined source values
 * are skipped). Mirrors MemoryStorage.deepMergeConfig in @mastra/core.
 */
export function deepMergeOMConfig(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...target };
  for (const key of Object.keys(source)) {
    const tVal = target[key];
    const sVal = source[key];
    if (isPlainObj(tVal) && isPlainObj(sVal)) {
      output[key] = deepMergeOMConfig(tVal, sVal);
    } else if (sVal !== undefined) {
      output[key] = sVal;
    }
  }
  return output;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return isPlainObj(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function findRecordById(ctx: MutationCtx<any>, convexTable: string, id: string) {
  return await ctx.db
    .query(convexTable)
    .withIndex('by_record_id', (q: any) => q.eq('id', id))
    .unique();
}

function requireRecord(doc: unknown, id: string) {
  if (!doc) {
    throw new Error(`Observational memory record not found: ${id}`);
  }
  return doc as Record<string, any> & { _id: any };
}

function requireWritableRecord(doc: unknown, id: string, expectedWriteEpoch?: number) {
  const record = requireRecord(doc, id);
  if ((record.recordState ?? 'active') !== 'active' || Number(record.writeEpoch ?? 0) !== (expectedWriteEpoch ?? 0)) {
    throw new Error(`Observational memory record is stale or sealed: ${id}`);
  }
  return record;
}

function parseStoredArray(value: unknown): Array<Record<string, any>> {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseArchive(doc: Record<string, any>): Record<string, any> | null {
  const parsed = parseJsonObject(doc.archive);
  return typeof parsed.archiveId === 'string' ? parsed : null;
}

function archiveEntry(doc: Record<string, any>, input: Record<string, any>) {
  const archive = parseArchive(doc);
  if (!archive || doc.resourceId !== input.resourceId) return null;
  if (input.scope === 'thread' && doc.scope === 'thread' && doc.threadId !== input.threadId) return null;
  const projectedThreadId = input.scope === 'thread' ? input.threadId : input.filterThreadId;
  const groups = (Array.isArray(archive.groups) ? archive.groups : []).filter((group: Record<string, any>) => {
    if (!projectedThreadId) return true;
    if (doc.scope === 'thread') return doc.threadId === projectedThreadId;
    return group.sourceThreadId === projectedThreadId;
  });
  if (groups.length === 0) return null;
  return {
    archiveId: archive.archiveId,
    recordId: doc.id,
    scope: doc.scope,
    threadId: doc.threadId ?? null,
    resourceId: doc.resourceId,
    archivedAt: archive.archivedAt,
    generationCount: doc.generationCount,
    observationTokenCount: archive.observationTokenCount,
    groups,
  };
}

function archiveCompare(a: Record<string, any>, b: Record<string, any>): number {
  return (
    String(b.archivedAt).localeCompare(String(a.archivedAt)) ||
    Number(b.generationCount) - Number(a.generationCount) ||
    String(b.archiveId).localeCompare(String(a.archiveId))
  );
}

function encodeArchiveCursor(entry: Record<string, any>): string {
  return JSON.stringify({
    archivedAt: entry.archivedAt,
    generationCount: entry.generationCount,
    archiveId: entry.archiveId,
  });
}

const EMPTY_SWAP_RESULT = {
  chunksActivated: 0,
  messageTokensActivated: 0,
  observationTokensActivated: 0,
  messagesActivated: 0,
  activatedCycleIds: [] as string[],
  activatedMessageIds: [] as string[],
};

export async function handleObservationalMemoryOperation(
  ctx: MutationCtx<any>,
  convexTable: string,
  request: OMRequest,
): Promise<StorageResponse> {
  switch (request.op) {
    case 'omGetLatest': {
      // by_lookup_key is [lookupKey, generationCount]; after eq(lookupKey) the
      // descending order sorts by generationCount, so first() is the latest generation.
      const docs = await ctx.db
        .query(convexTable)
        .withIndex('by_lookup_key', (q: any) => q.eq('lookupKey', request.lookupKey))
        .order('desc')
        .take(OM_QUERY_MAX_DOCS);
      const doc = docs.find((candidate: any) => (candidate.recordState ?? 'active') === 'active');
      return { ok: true, result: doc ?? null };
    }

    case 'omGetHistory': {
      let docs = await ctx.db
        .query(convexTable)
        .withIndex('by_lookup_key', (q: any) => q.eq('lookupKey', request.lookupKey))
        .order('desc')
        .take(OM_QUERY_MAX_DOCS);

      // createdAt is a UTC ISO string, so lexicographic comparison is chronological.
      if (request.from) {
        docs = docs.filter((doc: any) => typeof doc.createdAt === 'string' && doc.createdAt >= request.from!);
      }
      if (request.to) {
        docs = docs.filter((doc: any) => typeof doc.createdAt === 'string' && doc.createdAt <= request.to!);
      }
      if (request.offset != null) {
        docs = docs.slice(request.offset);
      }
      return { ok: true, result: docs.slice(0, request.limit) };
    }

    case 'omUpdateActive': {
      const doc = requireWritableRecord(
        await findRecordById(ctx, convexTable, request.id),
        request.id,
        request.expectedWriteEpoch,
      );
      const safeTokenCount = Number.isFinite(request.tokenCount) && request.tokenCount >= 0 ? request.tokenCount : 0;

      await ctx.db.patch(doc._id, {
        activeObservations: request.observations,
        observationGroups: request.observationGroups ? JSON.stringify(request.observationGroups) : null,
        lastObservedAt: request.lastObservedAt,
        // Reset pending tokens since we've now observed them
        pendingMessageTokens: 0,
        observationTokenCount: safeTokenCount,
        totalTokensObserved: Number(doc.totalTokensObserved || 0) + safeTokenCount,
        observedMessageIds: request.observedMessageIds,
        updatedAt: request.updatedAt,
      });
      return { ok: true };
    }

    case 'omAppendBufferedChunk': {
      const doc = requireWritableRecord(
        await findRecordById(ctx, convexTable, request.id),
        request.id,
        request.expectedWriteEpoch,
      );
      const chunks = parseStoredChunks(doc.bufferedObservationChunks);
      if (chunks.some(chunk => chunk.cycleId === request.chunk.cycleId)) return { ok: true };
      chunks.push(request.chunk);

      const patch: Record<string, unknown> = {
        bufferedObservationChunks: JSON.stringify(chunks),
        updatedAt: request.updatedAt,
      };
      if (request.lastBufferedAtTime) {
        patch.lastBufferedAtTime = request.lastBufferedAtTime;
      }
      await ctx.db.patch(doc._id, patch);
      return { ok: true };
    }

    case 'omSwapBuffered': {
      const doc = requireWritableRecord(
        await findRecordById(ctx, convexTable, request.id),
        request.id,
        request.expectedWriteEpoch,
      );

      const persistedChunks = parseStoredChunks(doc.bufferedObservationChunks);
      // Nothing buffered (or already swapped) — report zero activation.
      if (persistedChunks.length === 0) {
        return { ok: true, result: EMPTY_SWAP_RESULT };
      }

      // Use caller-provided refreshed chunks (with up-to-date token weights)
      // for activation math when present, falling back to persisted chunks.
      const chunks = Array.isArray(request.bufferedChunks) ? request.bufferedChunks : persistedChunks;
      if (chunks.length === 0) {
        return { ok: true, result: EMPTY_SWAP_RESULT };
      }

      const chunksToActivate = selectActivationBoundary(chunks, {
        activationRatio: request.activationRatio,
        messageTokensThreshold: request.messageTokensThreshold,
        currentPendingTokens: request.currentPendingTokens,
        forceMaxActivation: request.forceMaxActivation,
      });
      const activatedChunks = chunks.slice(0, chunksToActivate);
      const remainingChunks = chunks.slice(chunksToActivate);

      // Combine activated chunks into content
      const activatedContent = activatedChunks.map(c => c.observations).join('\n\n');
      const activatedTokens = activatedChunks.reduce((sum, c) => sum + c.tokenCount, 0);
      const activatedMessageTokens = activatedChunks.reduce((sum, c) => sum + (c.messageTokens ?? 0), 0);
      const activatedMessageCount = activatedChunks.reduce((sum, c) => sum + (c.messageIds?.length ?? 0), 0);
      const activatedCycleIds = activatedChunks.map(c => c.cycleId).filter((id): id is string => !!id);
      const activatedMessageIds = activatedChunks.flatMap(c => c.messageIds ?? []);

      // Derive lastObservedAt from the latest activated chunk, or use provided value
      const latestChunk = activatedChunks[activatedChunks.length - 1];
      const lastObservedAt = request.lastObservedAt ?? latestChunk?.lastObservedAt ?? request.now;

      // Append activated content to active observations with message boundary for cache stability
      const existingActive = (doc.activeObservations as string) || '';
      const boundary = `\n\n--- message boundary (${lastObservedAt}) ---\n\n`;
      const newActive = existingActive ? `${existingActive}${boundary}${activatedContent}` : activatedContent;
      const existingGroups = parseStoredArray(doc.observationGroups);
      const activatedGroups = activatedChunks.flatMap(chunk => chunk.observationGroups ?? []);

      // NOTE: We intentionally do NOT add activatedMessageIds to observedMessageIds.
      // observedMessageIds is used by getUnobservedMessages to filter future messages.
      // Since AI SDK may reuse message IDs for new content, adding them here would
      // permanently block new content from being observed. Instead, we return
      // activatedMessageIds so the caller can remove them from messageList directly.

      await ctx.db.patch(doc._id, {
        activeObservations: newActive,
        observationGroups: JSON.stringify([...existingGroups, ...activatedGroups]),
        observationTokenCount: Number(doc.observationTokenCount || 0) + activatedTokens,
        // Decrement pending message tokens (clamped to zero)
        pendingMessageTokens: Math.max(0, Number(doc.pendingMessageTokens || 0) - activatedMessageTokens),
        bufferedObservationChunks: remainingChunks.length > 0 ? JSON.stringify(remainingChunks) : null,
        lastObservedAt,
        updatedAt: request.now,
      });

      // Use hints from the most recent activated chunk only — stale hints from older chunks are discarded
      const latestChunkHints = activatedChunks[activatedChunks.length - 1];

      return {
        ok: true,
        result: {
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
            messageCount: c.messageIds?.length ?? 0,
            observations: c.observations,
          })),
          suggestedContinuation: latestChunkHints?.suggestedContinuation ?? undefined,
          currentTask: latestChunkHints?.currentTask ?? undefined,
        },
      };
    }

    case 'omUpdateBufferedReflection': {
      const doc = requireWritableRecord(
        await findRecordById(ctx, convexTable, request.id),
        request.id,
        request.expectedWriteEpoch,
      );

      const existingContent = (doc.bufferedReflection as string) || '';
      await ctx.db.patch(doc._id, {
        bufferedReflection: existingContent ? `${existingContent}\n\n${request.reflection}` : request.reflection,
        bufferedReflectionTokens: Number(doc.bufferedReflectionTokens || 0) + request.tokenCount,
        bufferedReflectionInputTokens: Number(doc.bufferedReflectionInputTokens || 0) + request.inputTokenCount,
        reflectedObservationLineCount: request.reflectedObservationLineCount,
        updatedAt: request.updatedAt,
      });
      return { ok: true };
    }

    case 'omSwapBufferedReflection': {
      const { currentRecord, newId, tokenCount, now } = request;
      const doc = requireWritableRecord(
        await findRecordById(ctx, convexTable, currentRecord.id),
        currentRecord.id,
        request.expectedWriteEpoch ?? currentRecord.writeEpoch,
      );

      const bufferedReflection = (doc.bufferedReflection as string) || '';
      if (!bufferedReflection) {
        throw new Error('No buffered reflection to swap');
      }

      const newObservations = mergeReflectionWithUnreflected(
        (doc.activeObservations as string) || '',
        bufferedReflection,
        Number(doc.reflectedObservationLineCount || 0),
      );

      // Create the new generation record after clearing buffered state on the predecessor.
      const newRecord = {
        id: newId,
        lookupKey: currentRecord.lookupKey,
        scope: currentRecord.scope,
        resourceId: currentRecord.resourceId,
        threadId: currentRecord.threadId,
        recordState: 'active',
        writeEpoch: 0,
        activeObservations: newObservations,
        activeObservationsPendingUpdate: null,
        originType: 'reflection',
        config: currentRecord.config,
        generationCount: currentRecord.generationCount + 1,
        lastObservedAt: currentRecord.lastObservedAt,
        lastReflectionAt: now,
        pendingMessageTokens: 0,
        totalTokensObserved: currentRecord.totalTokensObserved,
        observationTokenCount: tokenCount,
        isObserving: false,
        isReflecting: false,
        isBufferingObservation: false,
        isBufferingReflection: false,
        lastBufferedAtTokens: 0,
        lastBufferedAtTime: null,
        observedTimezone: currentRecord.observedTimezone,
        metadata: currentRecord.metadata,
        createdAt: now,
        updatedAt: now,
      };
      // Clear buffered state on the old record. Reflection supersession keeps
      // legacy generations writable; only archive retirement seals a generation.
      await ctx.db.patch(doc._id, {
        bufferedReflection: null,
        bufferedReflectionTokens: null,
        bufferedReflectionInputTokens: null,
        reflectedObservationLineCount: null,
        updatedAt: now,
      });
      await ctx.db.insert(convexTable, newRecord);

      return { ok: true, result: newRecord };
    }

    case 'omUpdateConfig': {
      const doc = requireWritableRecord(
        await findRecordById(ctx, convexTable, request.id),
        request.id,
        request.expectedWriteEpoch,
      );

      const existing = parseJsonObject(doc.config);
      const incoming = parseJsonObject(request.config);
      const merged = deepMergeOMConfig(existing, incoming);

      await ctx.db.patch(doc._id, {
        config: JSON.stringify(merged),
        updatedAt: request.updatedAt,
      });
      return { ok: true };
    }

    case 'omCreateReflectionGeneration': {
      const doc = requireWritableRecord(
        await findRecordById(ctx, convexTable, request.currentRecordId),
        request.currentRecordId,
        request.expectedWriteEpoch,
      );
      if (Number(doc.generationCount) !== request.expectedGenerationCount) {
        throw new Error(`Observational memory record is stale: ${request.currentRecordId}`);
      }
      await ctx.db.patch(doc._id, {
        bufferedReflection: null,
        bufferedReflectionTokens: null,
        bufferedReflectionInputTokens: null,
        reflectedObservationLineCount: null,
        isReflecting: false,
        isBufferingReflection: false,
        updatedAt: request.newRecord.updatedAt,
      });
      await ctx.db.insert(convexTable, request.newRecord);
      return { ok: true, result: request.newRecord };
    }

    case 'omCreateArchiveGeneration': {
      const input = request.input;
      const allDocs = await ctx.db.query(convexTable).take(OM_QUERY_MAX_DOCS);
      const priorDoc = allDocs.find((candidate: any) => parseArchive(candidate)?.archiveId === input.archiveId);
      if (priorDoc) {
        const priorArchive = parseArchive(priorDoc)!;
        const priorGroups = Array.isArray(priorArchive.groups) ? priorArchive.groups : [];
        const retiredGroups = Array.isArray(input.retiredGroups) ? input.retiredGroups : [];
        const identical =
          priorArchive.sourceRecordId === input.currentRecordId &&
          priorArchive.sourceGenerationCount === input.expectedGenerationCount &&
          priorArchive.sourceWriteEpoch === input.expectedWriteEpoch &&
          priorArchive.contentDigest === input.contentDigest &&
          priorGroups.length === retiredGroups.length &&
          priorGroups.every((group: any, index: number) => group.groupId === retiredGroups[index]?.groupId);
        if (!identical) throw new Error(`Archive ID ${input.archiveId} is already bound to a different transition`);
        const successor = allDocs.find((candidate: any) => candidate.id === priorArchive.successorRecordId);
        if (!successor) throw new Error(`Archive successor not found: ${priorArchive.successorRecordId}`);
        return { ok: true, result: successor };
      }
      const doc = requireWritableRecord(
        await findRecordById(ctx, convexTable, input.currentRecordId),
        input.currentRecordId,
        input.expectedWriteEpoch,
      );
      if (Number(doc.generationCount) !== input.expectedGenerationCount) {
        throw new Error(`Observational memory record is stale: ${input.currentRecordId}`);
      }
      const archive = {
        archiveId: input.archiveId,
        archivedAt: input.archivedAt,
        sourceRecordId: doc.id,
        successorRecordId: request.successorId,
        generationCount: doc.generationCount,
        sourceGenerationCount: doc.generationCount,
        sourceWriteEpoch: Number(doc.writeEpoch ?? 0),
        contentDigest: input.contentDigest,
        observationTokenCount: input.retiredObservationTokenCount,
        groups: input.retiredGroups,
      };
      await ctx.db.patch(doc._id, {
        recordState: 'sealed',
        updatedAt: input.archivedAt,
        activeObservations: input.retiredObservations,
        observationGroups: JSON.stringify(input.retiredGroups),
        archive: JSON.stringify(archive),
        observationTokenCount: input.retiredObservationTokenCount,
        pendingMessageTokens: 0,
        bufferedObservationChunks: null,
        bufferedReflection: null,
        bufferedReflectionTokens: null,
        bufferedReflectionInputTokens: null,
        reflectedObservationLineCount: null,
        isReflecting: false,
        isObserving: false,
        isBufferingObservation: false,
        isBufferingReflection: false,
      });
      const successor = {
        ...doc,
        _id: undefined,
        _creationTime: undefined,
        id: request.successorId,
        recordState: 'active',
        writeEpoch: 0,
        createdAt: input.archivedAt,
        updatedAt: input.archivedAt,
        originType: 'archive',
        generationCount: Number(doc.generationCount) + 1,
        activeObservations: input.retainedObservations,
        observationGroups: JSON.stringify(input.retainedGroups),
        archive: null,
        observationTokenCount: input.retainedObservationTokenCount,
        bufferedReflection: null,
        bufferedReflectionTokens: null,
        bufferedReflectionInputTokens: null,
        reflectedObservationLineCount: null,
        isReflecting: false,
        isBufferingReflection: false,
      };
      delete successor._id;
      delete successor._creationTime;
      await ctx.db.insert(convexTable, successor);
      return { ok: true, result: successor };
    }

    case 'omListArchives': {
      const input = request.input;
      const limit = Math.min(Math.max(Number(input.limit ?? 20), 1), 20);
      const docs = await ctx.db.query(convexTable).take(OM_QUERY_MAX_DOCS);
      const normalizedText = input.text ? String(input.text).normalize('NFKC').toLocaleLowerCase() : undefined;
      let entries = docs
        .map((doc: any) => archiveEntry(doc, input))
        .filter((entry: any) => entry !== null)
        .map((entry: any) => ({
          ...entry,
          groups: entry.groups.filter((group: any) => {
            if (input.from && (!group.observedAt || group.observedAt.to < input.from)) return false;
            if (input.to && (!group.observedAt || group.observedAt.from > input.to)) return false;
            if (normalizedText && !String(group.searchText).includes(normalizedText)) return false;
            return true;
          }),
        }))
        .filter((entry: any) => entry.groups.length > 0)
        .sort(archiveCompare);
      if (input.cursor) {
        let cursor: Record<string, any>;
        try {
          cursor = JSON.parse(input.cursor);
        } catch {
          throw new Error('Invalid observation archive cursor');
        }
        entries = entries.filter((entry: any) => archiveCompare(entry, cursor) > 0);
      }
      const page = entries.slice(0, limit + 1);
      const hasMore = page.length > limit;
      const archives = hasMore ? page.slice(0, limit) : page;
      return {
        ok: true,
        result: {
          archives,
          nextCursor: hasMore ? encodeArchiveCursor(archives[archives.length - 1]!) : undefined,
        },
      };
    }

    case 'omGetArchive': {
      const input = request.input;
      const docs = await ctx.db.query(convexTable).take(OM_QUERY_MAX_DOCS);
      const doc = docs.find((candidate: any) => parseArchive(candidate)?.archiveId === input.archiveId);
      if (!doc) return { ok: true, result: null };
      const entry = archiveEntry(doc, input);
      if (!entry) return { ok: true, result: null };
      const groups = input.groupId
        ? entry.groups.filter((group: any) => group.groupId === input.groupId)
        : entry.groups;
      if (groups.length === 0) return { ok: true, result: null };
      entry.groups = groups;
      return {
        ok: true,
        result: {
          archive: entry,
          observations: groups
            .map((group: any) => String(doc.activeObservations).slice(group.textStart, group.textEnd))
            .join('\n\n'),
        },
      };
    }

    case 'omGetArchivesByGroupIds': {
      const input = request.input;
      const groupIds = Array.from(new Set(input.groupIds as string[]));
      if (groupIds.length > 20) throw new Error('Observation archive group lookup supports at most 20 group IDs');
      const requested = new Set(groupIds);
      const docs = await ctx.db.query(convexTable).take(OM_QUERY_MAX_DOCS);
      const matches = docs
        .map((doc: any) => archiveEntry(doc, input))
        .filter((entry: any) => entry !== null)
        .map((entry: any) => {
          const groups = entry.groups.filter((group: any) => requested.has(group.groupId));
          entry.groups = groups;
          return { archive: entry, groupIds: groups.map((group: any) => group.groupId) };
        })
        .filter((match: any) => match.groupIds.length > 0)
        .sort((a: any, b: any) => archiveCompare(a.archive, b.archive));
      return { ok: true, result: { matches } };
    }

    case 'omClearBufferedReflection': {
      const doc = requireWritableRecord(
        await findRecordById(ctx, convexTable, request.id),
        request.id,
        request.expectedWriteEpoch,
      );
      const patch = {
        bufferedReflection: null,
        bufferedReflectionTokens: null,
        bufferedReflectionInputTokens: null,
        reflectedObservationLineCount: null,
        isReflecting: false,
        isBufferingReflection: false,
        writeEpoch: Number(doc.writeEpoch ?? 0) + 1,
        updatedAt: request.updatedAt,
      };
      await ctx.db.patch(doc._id, patch);
      return { ok: true, result: { ...doc, ...patch } };
    }
  }
}
