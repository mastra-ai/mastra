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
      | 'omInitialize'
      | 'omCreateReflectionGeneration'
      | 'omSetPendingMessageTokens'
      | 'omSetBufferingObservationFlag'
      | 'omUpdateActive'
      | 'omAppendBufferedChunk'
      | 'omSwapBuffered'
      | 'omUpdateBufferedReflection'
      | 'omSwapBufferedReflection'
      | 'omUpdateConfig';
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

// ---------------------------------------------------------------------------
// Lifecycle rules. These mirror @mastra/core's shared observational memory
// lifecycle helpers (packages/core/src/storage/domains/memory/observational-memory-lifecycle.ts),
// which this bundle cannot import at runtime. A parity test keeps them identical.
// ---------------------------------------------------------------------------

/**
 * A buffered chunk stores `lastObservedAt = max message time + 1ms`; it is wholly covered by
 * the cursor iff `cursor >= chunk.lastObservedAt - 1ms`.
 */
export function isChunkCoveredByCursor(chunkLastObservedAt: string, cursor: string | null | undefined): boolean {
  if (!cursor) return false;
  return Date.parse(cursor) >= Date.parse(chunkLastObservedAt) - 1;
}

/** The later of two ISO cursors (`null` only when both are absent). */
export function maxCursor(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return Date.parse(b) > Date.parse(a) ? b : a;
}

/**
 * New-generation text for a reflection built from `snapshot`: the reflection when the stored
 * text equals the snapshot; the reflection plus the appended tail when the stored text only
 * extends it; `null` (do not apply) after a non-append rewrite.
 */
export function planReflectionText(input: {
  storedObservations: string;
  storedObservationTokenCount: number;
  snapshotObservations: string;
  snapshotObservationTokenCount: number;
  reflection: string;
  tokenCount: number;
}): { observations: string; tokenCount: number } | null {
  const stored = input.storedObservations ?? '';
  const snapshot = input.snapshotObservations ?? '';
  if (stored === snapshot) return { observations: input.reflection, tokenCount: input.tokenCount };
  if (!stored.startsWith(snapshot)) return null;
  const tail = stored.slice(snapshot.length).trimStart();
  if (!tail.trim()) return { observations: input.reflection, tokenCount: input.tokenCount };
  return {
    observations: input.reflection ? `${input.reflection}\n\n${tail}` : tail,
    tokenCount:
      input.tokenCount +
      Math.max(0, (input.storedObservationTokenCount ?? 0) - (input.snapshotObservationTokenCount ?? 0)),
  };
}

/** Whether the stored text equals or only extends the snapshot. */
export function isAppendOnly(storedObservations: string, snapshotObservations: string): boolean {
  const stored = storedObservations ?? '';
  const snapshot = snapshotObservations ?? '';
  return stored === snapshot || stored.startsWith(snapshot);
}

type OMDoc = Record<string, any> & { _id: any };

/** Canonical head order: generationCount DESC, createdAt ASC, id ASC. */
function sortsBeforeAsHead(a: OMDoc, b: OMDoc): boolean {
  if (a.generationCount !== b.generationCount) return a.generationCount > b.generationCount;
  if (a.createdAt !== b.createdAt) return Date.parse(a.createdAt) < Date.parse(b.createdAt);
  return a.id < b.id;
}

/**
 * The canonical head of a lookup key. `by_lookup_key` orders ties by `_creationTime`, so when
 * the top two share a generation all tied rows are read and the canonical order picks one.
 */
async function getCanonicalHead(ctx: MutationCtx<any>, convexTable: string, lookupKey: string): Promise<OMDoc | null> {
  const top = (await ctx.db
    .query(convexTable)
    .withIndex('by_lookup_key', (q: any) => q.eq('lookupKey', lookupKey))
    .order('desc')
    .take(2)) as OMDoc[];
  if (top.length === 0) return null;
  if (top.length === 1 || top[1]!.generationCount !== top[0]!.generationCount) return top[0]!;
  const tied = (await ctx.db
    .query(convexTable)
    .withIndex('by_lookup_key', (q: any) => q.eq('lookupKey', lookupKey).eq('generationCount', top[0]!.generationCount))
    .collect()) as OMDoc[];
  return tied.reduce((best, doc) => (sortsBeforeAsHead(doc, best) ? doc : best));
}

type Target = { kind: 'missing' } | { kind: 'live'; doc: OMDoc } | { kind: 'retired'; doc: OMDoc; head: OMDoc | null };

/**
 * Liveness of the record a lifecycle write names. A record with `supersededBy` set is retired.
 * A record that is unmarked but is not its key's canonical head (left by an older adapter
 * version, which never set the marker) is marked superseded by the head here and treated as
 * retired, so a write never lands on it.
 */
async function resolveTarget(ctx: MutationCtx<any>, convexTable: string, id: string, now: string): Promise<Target> {
  const doc = (await findRecordById(ctx, convexTable, id)) as OMDoc | null;
  if (!doc) return { kind: 'missing' };
  const head = await getCanonicalHead(ctx, convexTable, doc.lookupKey);
  if (doc.supersededBy) return { kind: 'retired', doc, head };
  if (head && head.id !== doc.id) {
    await ctx.db.patch(doc._id, { supersededBy: head.id, updatedAt: now });
    return { kind: 'retired', doc, head };
  }
  return { kind: 'live', doc };
}

/** The live record a write aimed at `id` lands on (the head when `id` is retired). Throws when missing. */
async function resolveWriteTarget(ctx: MutationCtx<any>, convexTable: string, id: string, now: string): Promise<OMDoc> {
  const target = await resolveTarget(ctx, convexTable, id, now);
  if (target.kind === 'missing') return requireRecord(null, id);
  if (target.kind === 'live') return target.doc;
  if (!target.head) throw new Error(`Observational memory record ${id} is superseded but no live head was found`);
  return target.head;
}

/**
 * Create the next generation from the stored (live) record and retire it in the same mutation.
 * Buffered chunks move to the new generation; the cursor, buffering markers, flags, and
 * counters carry over; buffered reflection state does not.
 */
async function rollOver(
  ctx: MutationCtx<any>,
  convexTable: string,
  stored: OMDoc,
  args: { newId: string; observations: string; tokenCount: number; now: string; clearBufferedReflection: boolean },
): Promise<Record<string, unknown>> {
  const newRecord = {
    id: args.newId,
    lookupKey: stored.lookupKey,
    scope: stored.scope,
    resourceId: stored.resourceId ?? null,
    threadId: stored.threadId ?? null,
    activeObservations: args.observations,
    activeObservationsPendingUpdate: null,
    originType: 'reflection',
    config: stored.config,
    generationCount: Number(stored.generationCount || 0) + 1,
    lastObservedAt: stored.lastObservedAt ?? null,
    lastReflectionAt: args.now,
    pendingMessageTokens: Number(stored.pendingMessageTokens || 0),
    totalTokensObserved: Number(stored.totalTokensObserved || 0),
    observationTokenCount: args.tokenCount,
    isObserving: false,
    isReflecting: false,
    bufferedObservationChunks: parseStoredChunks(stored.bufferedObservationChunks).length
      ? stored.bufferedObservationChunks
      : null,
    isBufferingObservation: Boolean(stored.isBufferingObservation),
    isBufferingReflection: false,
    lastBufferedAtTokens: Number(stored.lastBufferedAtTokens || 0),
    lastBufferedAtTime: stored.lastBufferedAtTime ?? null,
    observedTimezone: stored.observedTimezone ?? null,
    metadata: stored.metadata ?? null,
    supersededBy: null,
    createdAt: args.now,
    updatedAt: args.now,
  };
  await ctx.db.insert(convexTable, newRecord);
  await ctx.db.patch(stored._id, {
    supersededBy: args.newId,
    bufferedObservationChunks: null,
    ...(args.clearBufferedReflection
      ? {
          bufferedReflection: null,
          bufferedReflectionTokens: null,
          bufferedReflectionInputTokens: null,
          reflectedObservationLineCount: null,
        }
      : {}),
    updatedAt: args.now,
  });
  return newRecord;
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
      return { ok: true, result: await getCanonicalHead(ctx, convexTable, request.lookupKey) };
    }

    case 'omInitialize': {
      // One serializable mutation: concurrent initializations of a key create one record.
      const existing = await getCanonicalHead(ctx, convexTable, request.record.lookupKey);
      if (existing) return { ok: true, result: existing };
      await ctx.db.insert(convexTable, { ...request.record, supersededBy: null });
      return { ok: true, result: { ...request.record, supersededBy: null } };
    }

    case 'omCreateReflectionGeneration': {
      const { currentRecord, newId, reflection, tokenCount, now } = request;
      const target = await resolveTarget(ctx, convexTable, currentRecord.id, now);
      // Missing target: create nothing (the client returns its snapshot).
      if (target.kind === 'missing') return { ok: true, result: null };
      // A retired snapshot creates nothing; the caller adopts the head.
      if (target.kind === 'retired') return { ok: true, result: target.head };
      const stored = target.doc;
      const plan = planReflectionText({
        storedObservations: (stored.activeObservations as string) || '',
        storedObservationTokenCount: Number(stored.observationTokenCount || 0),
        snapshotObservations: currentRecord.activeObservations ?? '',
        snapshotObservationTokenCount: currentRecord.observationTokenCount ?? 0,
        reflection,
        tokenCount,
      });
      // The text was rewritten (not only appended to) since the snapshot: the reflection is stale.
      if (!plan) return { ok: true, result: stored };
      const newRecord = await rollOver(ctx, convexTable, stored, {
        newId,
        observations: plan.observations,
        tokenCount: plan.tokenCount,
        now,
        clearBufferedReflection: false,
      });
      return { ok: true, result: newRecord };
    }

    case 'omSetPendingMessageTokens': {
      const doc = await resolveWriteTarget(ctx, convexTable, request.id, request.updatedAt);
      await ctx.db.patch(doc._id, { pendingMessageTokens: request.tokenCount, updatedAt: request.updatedAt });
      return { ok: true };
    }

    case 'omSetBufferingObservationFlag': {
      const doc = await resolveWriteTarget(ctx, convexTable, request.id, request.updatedAt);
      await ctx.db.patch(doc._id, {
        isBufferingObservation: request.isBuffering,
        ...(request.lastBufferedAtTokens !== undefined ? { lastBufferedAtTokens: request.lastBufferedAtTokens } : {}),
        updatedAt: request.updatedAt,
      });
      return { ok: true };
    }

    case 'omGetHistory': {
      let docs =
        request.recordId !== undefined
          ? [await findRecordById(ctx, convexTable, request.recordId)].filter(
              (doc: any) => doc?.lookupKey === request.lookupKey,
            )
          : await ctx.db
              .query(convexTable)
              .withIndex('by_lookup_key', (q: any) => {
                // Bound generations in the index so the row cap applies to the requested range and direction.
                let range = q.eq('lookupKey', request.lookupKey);
                if (request.afterGeneration !== undefined) range = range.gt('generationCount', request.afterGeneration);
                if (request.beforeGeneration !== undefined)
                  range = range.lt('generationCount', request.beforeGeneration);
                return range;
              })
              .order(request.sortDirection === 'ASC' ? 'asc' : 'desc')
              .take(OM_QUERY_MAX_DOCS);

      // createdAt is a UTC ISO string, so lexicographic comparison is chronological.
      if (request.from) {
        docs = docs.filter((doc: any) => typeof doc.createdAt === 'string' && doc.createdAt >= request.from!);
      }
      if (request.to) {
        docs = docs.filter((doc: any) => typeof doc.createdAt === 'string' && doc.createdAt <= request.to!);
      }
      if (request.groupId !== undefined) {
        const prefix = `<observation-group id="${request.groupId}"`;
        docs = docs.filter(
          (doc: any) =>
            (typeof doc.activeObservations === 'string' && doc.activeObservations.includes(prefix)) ||
            parseStoredChunks(doc.bufferedObservationChunks).some(chunk => chunk.observations.includes(prefix)),
        );
      }
      if (request.beforeGeneration !== undefined) {
        docs = docs.filter((doc: any) => doc.generationCount < request.beforeGeneration!);
      }
      if (request.afterGeneration !== undefined) {
        docs = docs.filter((doc: any) => doc.generationCount > request.afterGeneration!);
      }
      const direction = request.sortDirection === 'ASC' ? 1 : -1;
      docs.sort(
        (a: any, b: any) =>
          direction * (a.generationCount - b.generationCount) ||
          a.createdAt.localeCompare(b.createdAt) ||
          a.id.localeCompare(b.id),
      );
      if (request.offset != null) {
        docs = docs.slice(request.offset);
      }
      return { ok: true, result: docs.slice(0, request.limit) };
    }

    case 'omUpdateActive': {
      const target = await resolveTarget(ctx, convexTable, request.id, request.updatedAt);
      if (target.kind === 'missing') requireRecord(null, request.id);
      if (target.kind !== 'live') return { ok: true, result: { applied: false, reason: 'retired' } };
      const doc = target.doc;
      if (
        request.expectedActiveObservations !== undefined &&
        request.expectedActiveObservations !== ((doc.activeObservations as string) || '')
      ) {
        return { ok: true, result: { applied: false, reason: 'conflict' } };
      }
      const safeTokenCount = Number.isFinite(request.tokenCount) && request.tokenCount >= 0 ? request.tokenCount : 0;

      await ctx.db.patch(doc._id, {
        activeObservations: request.observations,
        // The cursor never moves backward.
        lastObservedAt: maxCursor(doc.lastObservedAt, request.lastObservedAt),
        // Reset pending tokens since we've now observed them
        pendingMessageTokens: 0,
        observationTokenCount: safeTokenCount,
        totalTokensObserved: Number(doc.totalTokensObserved || 0) + safeTokenCount,
        observedMessageIds: request.observedMessageIds,
        updatedAt: request.updatedAt,
      });
      return { ok: true, result: { applied: true } };
    }

    case 'omAppendBufferedChunk': {
      // A retired id is redirected to the head.
      const doc = await resolveWriteTarget(ctx, convexTable, request.id, request.updatedAt);
      const chunks = parseStoredChunks(doc.bufferedObservationChunks);
      // Skip a retried append (same cycle) and a chunk the cursor already wholly covers.
      if (
        chunks.some(chunk => chunk.cycleId === request.chunk.cycleId) ||
        isChunkCoveredByCursor(request.chunk.lastObservedAt, doc.lastObservedAt)
      ) {
        return { ok: true, result: { persisted: false, recordId: doc.id } };
      }
      chunks.push(request.chunk);

      await ctx.db.patch(doc._id, {
        bufferedObservationChunks: JSON.stringify(chunks),
        // lastBufferedAtTime never moves backward.
        lastBufferedAtTime: maxCursor(doc.lastBufferedAtTime, request.lastBufferedAtTime),
        updatedAt: request.updatedAt,
      });
      return { ok: true, result: { persisted: true, recordId: doc.id } };
    }

    case 'omSwapBuffered': {
      const target = await resolveTarget(ctx, convexTable, request.id, request.now);
      if (target.kind === 'missing') requireRecord(null, request.id);
      // A retired record is frozen: activation reports it and writes nothing.
      if (target.kind !== 'live') return { ok: true, result: { ...EMPTY_SWAP_RESULT, retired: true } };
      const doc = target.doc;

      // Activation always works on the stored list, so a chunk appended after the caller read
      // the record is never dropped. Caller-provided chunks only override token weights.
      const refreshedWeights = new Map((request.bufferedChunks ?? []).map(chunk => [chunk.id, chunk.messageTokens]));
      const storedChunks = parseStoredChunks(doc.bufferedObservationChunks);
      const chunks = storedChunks.map(chunk => {
        const weight = refreshedWeights.get(chunk.id);
        return weight === undefined ? chunk : { ...chunk, messageTokens: weight };
      });
      // Nothing buffered (or already swapped) — report zero activation.
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
      const remainingChunks = storedChunks.slice(chunksToActivate);

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

      // NOTE: We intentionally do NOT add activatedMessageIds to observedMessageIds.
      // observedMessageIds is used by getUnobservedMessages to filter future messages.
      // Since AI SDK may reuse message IDs for new content, adding them here would
      // permanently block new content from being observed. Instead, we return
      // activatedMessageIds so the caller can remove them from messageList directly.

      await ctx.db.patch(doc._id, {
        activeObservations: newActive,
        observationTokenCount: Number(doc.observationTokenCount || 0) + activatedTokens,
        // Decrement pending message tokens (clamped to zero)
        pendingMessageTokens: Math.max(0, Number(doc.pendingMessageTokens || 0) - activatedMessageTokens),
        bufferedObservationChunks: remainingChunks.length > 0 ? JSON.stringify(remainingChunks) : null,
        // The stored cursor never moves backward (a sync observation may already be past this chunk).
        lastObservedAt: maxCursor(doc.lastObservedAt, lastObservedAt),
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
      const doc = requireRecord(await findRecordById(ctx, convexTable, request.id), request.id);

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
      const target = await resolveTarget(ctx, convexTable, currentRecord.id, now);
      // Missing target: create nothing (the client returns its snapshot).
      if (target.kind === 'missing') return { ok: true, result: null };
      // A retired snapshot creates nothing; the caller adopts the head.
      if (target.kind === 'retired') return { ok: true, result: target.head };
      const stored = target.doc;

      const bufferedReflection = (stored.bufferedReflection as string) || '';
      if (!bufferedReflection) {
        throw new Error('No buffered reflection to swap');
      }
      const storedObservations = (stored.activeObservations as string) || '';
      // Only appends may have happened since the caller's snapshot; a rewrite invalidates the
      // reflected line count.
      if (!isAppendOnly(storedObservations, currentRecord.activeObservations ?? '')) {
        return { ok: true, result: stored };
      }

      const newObservations = mergeReflectionWithUnreflected(
        storedObservations,
        bufferedReflection,
        Number(stored.reflectedObservationLineCount || 0),
      );
      // tokenCount is computed by the processor from its snapshot; add tokens appended since.
      const carriedTokenCount =
        tokenCount +
        Math.max(0, Number(stored.observationTokenCount || 0) - (currentRecord.observationTokenCount ?? 0));

      const newRecord = await rollOver(ctx, convexTable, stored, {
        newId,
        observations: newObservations,
        tokenCount: carriedTokenCount,
        now,
        clearBufferedReflection: true,
      });
      return { ok: true, result: newRecord };
    }

    case 'omUpdateConfig': {
      const doc = requireRecord(await findRecordById(ctx, convexTable, request.id), request.id);

      const existing = parseJsonObject(doc.config);
      const incoming = parseJsonObject(request.config);
      const merged = deepMergeOMConfig(existing, incoming);

      await ctx.db.patch(doc._id, {
        config: JSON.stringify(merged),
        updatedAt: request.updatedAt,
      });
      return { ok: true };
    }
  }
}
