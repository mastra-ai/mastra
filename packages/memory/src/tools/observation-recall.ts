import type {
  ArchivedObservationGroup,
  GetObservationArchivesByGroupIdsResult,
  GetObservationArchiveResult,
  ListObservationArchivesInput,
  ListObservationArchivesResult,
  ObservationArchiveEntry,
  ObservationArchiveScopeInput,
} from '@mastra/core/storage';
import { estimateTokenCount } from 'tokenx';
import xxhash from 'xxhash-wasm';

import { safeSlice } from '../processors/observational-memory/string-utils';

const DEFAULT_MAX_RESULT_TOKENS = 2_000;
const MAX_RESULTS = 20;

/** Module-level xxhash singleton — loaded once, shared across recall executions. */
const hasherPromise = xxhash();

export interface ObservationRecallInput {
  mode: 'observations';
  archiveId?: string;
  groupId?: string;
  cursor?: string;
  limit?: number;
  threadId?: string;
  before?: string;
  after?: string;
  text?: string;
  query?: string;
  charOffset?: number;
}

export interface ObservationRecallSource {
  threadId?: string;
  messageRange?: string;
  messageCursorStart?: string;
  messageCursorEnd?: string;
  sourceUnavailable: boolean;
}

export interface ObservationRecallGroup {
  groupId: string;
  summary: string;
  observedAt?: { from: string; to: string };
  source: ObservationRecallSource;
}

export interface ObservationRecallArchive {
  archiveId: string;
  archivedAt: string;
  generationCount: number;
  groupIds: string[];
  groups: ObservationRecallGroup[];
}

export interface ObservationRecallResult {
  /** Exact chunk of the selected retired observation group. */
  observations: string;
  archiveId?: string;
  groupId?: string;
  groupIds: string[];
  charOffset: number;
  nextCharOffset?: number;
  truncated: boolean;
  source?: ObservationRecallSource;
  archives: ObservationRecallArchive[];
  count: number;
  nextCursor?: string;
}

export type ObservationRecallStore = {
  listObservationArchives: (input: ListObservationArchivesInput) => Promise<ListObservationArchivesResult>;
  getObservationArchive: (
    input: ObservationArchiveScopeInput & { archiveId: string; groupId?: string },
  ) => Promise<GetObservationArchiveResult | null>;
  getObservationArchivesByGroupIds: (
    input: ObservationArchiveScopeInput & { groupIds: string[] },
  ) => Promise<GetObservationArchivesByGroupIdsResult>;
};

type ObservationSearchResult = {
  threadId: string;
  score: number;
  groupId?: string;
  observedAt?: Date;
};

export type ObservationRecallMemory = {
  getMemoryStore: () => Promise<ObservationRecallStore>;
  getThreadById?: (args: { threadId: string }) => Promise<{
    id: string;
    resourceId: string;
  } | null>;
  searchMessages?: (args: {
    query: string;
    resourceId: string;
    topK?: number;
    filter?: {
      threadId?: string;
      observedAfter?: Date;
      observedBefore?: Date;
    };
  }) => Promise<{ results: ObservationSearchResult[] }>;
};

export interface ExecuteObservationRecallInput extends Omit<ObservationRecallInput, 'mode'> {
  memory: ObservationRecallMemory;
  retrievalScope: 'thread' | 'resource';
  currentThreadId?: string;
  resourceId?: string;
  searchEnabled: boolean;
  /** When true, returned thread ids are xxhash representations, never raw identifiers. */
  obscureThreadIds?: boolean;
  abortSignal?: AbortSignal;
  maxTokens?: number;
}

function parseDate(value: string | undefined, field: 'before' | 'after'): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${field} date: ${value}`);
  }
  return date;
}

function parseMessageRange(
  range: string | undefined,
): Pick<ObservationRecallSource, 'messageCursorStart' | 'messageCursorEnd'> {
  if (!range) return {};
  const separator = range.indexOf(':');
  if (separator <= 0 || separator >= range.length - 1) return {};
  return {
    messageCursorStart: range.slice(0, separator),
    messageCursorEnd: range.slice(separator + 1),
  };
}

function toSource(
  group: ArchivedObservationGroup,
  archive: ObservationArchiveEntry,
  representThreadId?: (threadId: string) => string,
): ObservationRecallSource {
  const messageCursors = parseMessageRange(group.messageRange);
  const sourceThreadId = group.sourceThreadId ?? archive.threadId ?? undefined;
  return {
    threadId: sourceThreadId ? (representThreadId ? representThreadId(sourceThreadId) : sourceThreadId) : undefined,
    messageRange: group.messageRange,
    ...messageCursors,
    sourceUnavailable: group.sourceUnavailable === true || !group.messageRange,
  };
}

function toArchiveResult(
  archive: ObservationArchiveEntry,
  representThreadId?: (threadId: string) => string,
): ObservationRecallArchive {
  return {
    archiveId: archive.archiveId,
    archivedAt: archive.archivedAt.toISOString(),
    generationCount: archive.generationCount,
    groupIds: archive.groups.map(group => group.groupId),
    groups: archive.groups.map(group => ({
      groupId: group.groupId,
      summary: group.summary,
      observedAt: group.observedAt
        ? { from: group.observedAt.from.toISOString(), to: group.observedAt.to.toISOString() }
        : undefined,
      source: toSource(group, archive, representThreadId),
    })),
  };
}

function validateCharOffset(text: string, charOffset: number | undefined): number {
  const offset = charOffset ?? 0;
  if (!Number.isInteger(offset) || offset < 0 || offset > text.length) {
    throw new Error(`charOffset must be an integer between 0 and ${text.length}`);
  }
  if (offset > 0 && offset < text.length) {
    const previous = text.charCodeAt(offset - 1);
    const current = text.charCodeAt(offset);
    if (previous >= 0xd800 && previous <= 0xdbff && current >= 0xdc00 && current <= 0xdfff) {
      throw new Error('charOffset cannot point between the UTF-16 code units of a surrogate pair');
    }
  }
  return offset;
}

function chunkObservationText(
  text: string,
  charOffset: number | undefined,
  maxTokens: number,
): { text: string; charOffset: number; nextCharOffset?: number; truncated: boolean } {
  const offset = validateCharOffset(text, charOffset);
  const remaining = text.slice(offset);
  if (!remaining || estimateTokenCount(remaining) <= maxTokens) {
    return { text: remaining, charOffset: offset, truncated: false };
  }

  let low = 1;
  let high = remaining.length;
  let best = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = safeSlice(remaining, mid);
    if (estimateTokenCount(candidate) <= maxTokens) {
      best = candidate.length;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (best === 0) {
    const firstCodePointLength = remaining.codePointAt(0)! > 0xffff ? 2 : 1;
    best = firstCodePointLength;
  }

  const chunk = safeSlice(remaining, best);
  const nextCharOffset = offset + chunk.length;
  return {
    text: chunk,
    charOffset: offset,
    nextCharOffset: nextCharOffset < text.length ? nextCharOffset : undefined,
    truncated: nextCharOffset < text.length,
  };
}

function groupMatchesFilters(
  group: ArchivedObservationGroup,
  input: { from?: Date; to?: Date; text?: string },
): boolean {
  if (input.from || input.to) {
    if (!group.observedAt) return false;
    if (input.from && group.observedAt.to < input.from) return false;
    if (input.to && group.observedAt.from > input.to) return false;
  }
  if (input.text) {
    const normalized = input.text.normalize('NFKC').toLowerCase();
    if (!group.searchText.includes(normalized)) return false;
  }
  return true;
}

async function resolveScope({
  memory,
  retrievalScope,
  currentThreadId,
  resourceId,
  threadId,
}: Pick<
  ExecuteObservationRecallInput,
  'memory' | 'retrievalScope' | 'currentThreadId' | 'resourceId' | 'threadId'
>): Promise<{
  scope: ObservationArchiveScopeInput;
  searchThreadId?: string;
}> {
  const explicitThreadId = threadId === 'current' ? currentThreadId : threadId;

  if (threadId === 'current' && !currentThreadId) {
    throw new Error('Could not resolve current thread.');
  }

  if (retrievalScope === 'thread') {
    if (!currentThreadId) {
      throw new Error('Current thread is required for observation recall');
    }
    if (explicitThreadId && explicitThreadId !== currentThreadId) {
      throw new Error('Observation recall is limited to the current thread');
    }
    const thread = memory.getThreadById ? await memory.getThreadById({ threadId: currentThreadId }) : null;
    const resolvedResourceId = resourceId ?? thread?.resourceId;
    if (!resolvedResourceId || (thread && resourceId && thread.resourceId !== resourceId)) {
      throw new Error('Resource ID is required for observation recall');
    }
    return {
      scope: { scope: 'thread', resourceId: resolvedResourceId, threadId: currentThreadId },
      searchThreadId: currentThreadId,
    };
  }

  if (!resourceId) {
    throw new Error('Resource ID is required for observation recall');
  }

  if (explicitThreadId) {
    if (!memory.getThreadById) {
      throw new Error('Memory instance cannot verify thread access for observation recall');
    }
    const thread = await memory.getThreadById({ threadId: explicitThreadId });
    if (!thread || thread.resourceId !== resourceId) {
      throw new Error('Thread does not belong to the active resource');
    }
  }

  return {
    scope: {
      scope: 'resource',
      resourceId,
      ...(explicitThreadId ? { filterThreadId: explicitThreadId } : {}),
    },
    searchThreadId: explicitThreadId,
  };
}

async function loadSemanticArchives({
  memory,
  store,
  scope,
  searchThreadId,
  resourceId,
  query,
  from,
  to,
  text,
  limit,
}: {
  memory: ObservationRecallMemory;
  store: ObservationRecallStore;
  scope: ObservationArchiveScopeInput;
  searchThreadId?: string;
  resourceId: string;
  query: string;
  from?: Date;
  to?: Date;
  text?: string;
  limit: number;
}): Promise<ObservationArchiveEntry[]> {
  if (!memory.searchMessages) return [];
  const search = await memory.searchMessages({
    query,
    resourceId,
    topK: MAX_RESULTS,
    filter: {
      ...(searchThreadId ? { threadId: searchThreadId } : {}),
      ...(from ? { observedAfter: from } : {}),
      ...(to ? { observedBefore: to } : {}),
    },
  });
  const rankedGroupIds = Array.from(
    new Set(search.results.map(result => result.groupId).filter((groupId): groupId is string => Boolean(groupId))),
  ).slice(0, MAX_RESULTS);
  if (rankedGroupIds.length === 0) return [];

  const resolved = await store.getObservationArchivesByGroupIds({ ...scope, groupIds: rankedGroupIds });
  const rank = new Map(rankedGroupIds.map((groupId, index) => [groupId, index]));
  return resolved.matches
    .map(match => ({
      ...match.archive,
      groups: match.archive.groups
        .filter(group => rank.has(group.groupId) && groupMatchesFilters(group, { from, to, text }))
        .sort((a, b) => rank.get(a.groupId)! - rank.get(b.groupId)!),
    }))
    .filter(archive => archive.groups.length > 0)
    .sort((a, b) => {
      const aRank = Math.min(...a.groups.map(group => rank.get(group.groupId)!));
      const bRank = Math.min(...b.groups.map(group => rank.get(group.groupId)!));
      return aRank - bRank;
    })
    .slice(0, limit);
}

export async function recallObservations(input: ExecuteObservationRecallInput): Promise<ObservationRecallResult> {
  input.abortSignal?.throwIfAborted();
  const limit = Math.min(Math.max(input.limit ?? 20, 1), MAX_RESULTS);
  const from = parseDate(input.after, 'after');
  const to = parseDate(input.before, 'before');
  if (from && to && from > to) {
    throw new Error('after must be earlier than or equal to before');
  }
  if (input.groupId && !input.archiveId) {
    throw new Error('archiveId is required when groupId is provided');
  }
  if (input.charOffset !== undefined && (!input.archiveId || !input.groupId)) {
    throw new Error('archiveId and groupId are required when charOffset is provided');
  }
  if (input.query && input.cursor) {
    throw new Error('cursor cannot be combined with semantic observation query');
  }

  const { scope, searchThreadId } = await resolveScope(input);
  const store = await input.memory.getMemoryStore();
  input.abortSignal?.throwIfAborted();

  let representThreadId: ((threadId: string) => string) | undefined;
  if (input.obscureThreadIds) {
    const hasher = await hasherPromise;
    representThreadId = (threadId: string) => hasher.h32ToString(threadId);
  }

  let archives: ObservationArchiveEntry[];
  let nextCursor: string | undefined;

  if (input.archiveId) {
    const direct = await store.getObservationArchive({
      ...scope,
      archiveId: input.archiveId,
      groupId: input.groupId,
    });
    if (!direct) {
      throw new Error('Observation archive or group not found');
    }
    archives = [direct.archive];
  } else if (input.query) {
    if (!input.searchEnabled) {
      return {
        observations:
          'Semantic observation search is not configured. Enable it with `retrieval: { vector: true }` and configure a vector store and embedder on your Memory instance.',
        groupIds: [],
        charOffset: 0,
        truncated: false,
        archives: [],
        count: 0,
      };
    }
    archives = await loadSemanticArchives({
      memory: input.memory,
      store,
      scope,
      searchThreadId,
      resourceId: scope.resourceId,
      query: input.query,
      from,
      to,
      text: input.text,
      limit,
    });
  } else {
    const listed = await store.listObservationArchives({
      ...scope,
      limit,
      cursor: input.cursor,
      from,
      to,
      text: input.text,
    });
    archives = listed.archives;
    nextCursor = listed.nextCursor;
  }

  input.abortSignal?.throwIfAborted();
  if (archives.length === 0) {
    return {
      observations: 'No archived observations found matching the criteria.',
      groupIds: [],
      charOffset: 0,
      truncated: false,
      archives: [],
      count: 0,
      nextCursor,
    };
  }

  const selectedArchive = archives[0]!;
  const selectedGroup = input.groupId
    ? selectedArchive.groups.find(group => group.groupId === input.groupId)
    : selectedArchive.groups[0];
  if (!selectedGroup) {
    throw new Error('Observation archive group not found');
  }

  const direct = await store.getObservationArchive({
    ...scope,
    archiveId: selectedArchive.archiveId,
    groupId: selectedGroup.groupId,
  });
  input.abortSignal?.throwIfAborted();
  if (!direct) {
    throw new Error('Observation archive group not found');
  }

  const chunk = chunkObservationText(
    direct.observations,
    input.charOffset,
    input.maxTokens ?? DEFAULT_MAX_RESULT_TOKENS,
  );
  return {
    observations: chunk.text,
    archiveId: selectedArchive.archiveId,
    groupId: selectedGroup.groupId,
    groupIds: selectedArchive.groups.map(group => group.groupId),
    charOffset: chunk.charOffset,
    nextCharOffset: chunk.nextCharOffset,
    truncated: chunk.truncated,
    source: toSource(selectedGroup, selectedArchive, representThreadId),
    archives: archives.map(archive => toArchiveResult(archive, representThreadId)),
    count: archives.length,
    nextCursor,
  };
}
