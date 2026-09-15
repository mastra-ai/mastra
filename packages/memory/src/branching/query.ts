import { createThreadBranchError } from '@mastra/core/memory';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type { MemoryStorage, StorageListMessagesInput, StorageListMessagesOutput } from '@mastra/core/storage';
import {
  compareMessageTuples,
  listRawThreads,
  parseThreadBranchMetadata,
  resolveThreadLineageEntries,
} from './lineage';
import type { MessageTuple, ResolvedThreadLineageEntry } from './lineage';

const BRANCH_QUERY_PAGE_SIZE = 100;

type DateRange = NonNullable<NonNullable<StorageListMessagesInput['filter']>['dateRange']>;

export type ThreadBranchSegment = {
  thread: StorageThreadType;
  lower?: MessageTuple;
  upper?: MessageTuple;
};

function minTuple(current: MessageTuple | undefined, candidate: MessageTuple): MessageTuple {
  return !current || compareMessageTuples(candidate, current) < 0 ? candidate : current;
}

export function buildThreadBranchSegments(entries: ResolvedThreadLineageEntry[]): ThreadBranchSegment[] {
  let upper: MessageTuple | undefined;
  const reversed: ThreadBranchSegment[] = [];

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    reversed.push({
      thread: entry.thread,
      ...(entry.branch
        ? { lower: { createdAt: entry.branch.branchPointCreatedAt, id: entry.branch.branchPointMessageId } }
        : {}),
      ...(upper ? { upper } : {}),
    });
    if (entry.branch) {
      upper = minTuple(upper, {
        createdAt: entry.branch.branchPointCreatedAt,
        id: entry.branch.branchPointMessageId,
      });
    }
  }

  return reversed.reverse();
}

function tupleInSegment(message: MastraDBMessage, segment: ThreadBranchSegment): boolean {
  if (message.threadId !== segment.thread.id || message.resourceId !== segment.thread.resourceId) return false;
  if (segment.lower && compareMessageTuples(message, segment.lower) <= 0) return false;
  if (segment.upper && compareMessageTuples(message, segment.upper) > 0) return false;
  return true;
}

function intersectDateRange(segment: ThreadBranchSegment, requested?: DateRange): DateRange | null {
  let start = requested?.start;
  let startExclusive = requested?.startExclusive ?? false;
  const lowerDate = segment.lower?.createdAt;
  if (lowerDate && (!start || lowerDate > start)) {
    start = lowerDate;
    startExclusive = false;
  }

  let end = requested?.end;
  let endExclusive = requested?.endExclusive ?? false;
  const upperDate = segment.upper?.createdAt;
  if (upperDate && (!end || upperDate < end)) {
    end = upperDate;
    endExclusive = false;
  }

  if (start && end) {
    if (start > end || (start.getTime() === end.getTime() && (startExclusive || endExclusive))) return null;
  }

  return {
    ...(start ? { start, startExclusive } : {}),
    ...(end ? { end, endExclusive } : {}),
  };
}

function messageMatchesRequestedDateRange(message: MastraDBMessage, range?: DateRange): boolean {
  if (!range) return true;
  const time = message.createdAt.getTime();
  if (range.start) {
    const start = range.start.getTime();
    if (time < start || (range.startExclusive && time === start)) return false;
  }
  if (range.end) {
    const end = range.end.getTime();
    if (time > end || (range.endExclusive && time === end)) return false;
  }
  return true;
}

function sortMessages(messages: MastraDBMessage[], direction: 'ASC' | 'DESC'): MastraDBMessage[] {
  return messages.sort((a, b) => (direction === 'ASC' ? compareMessageTuples(a, b) : compareMessageTuples(b, a)));
}

function dedupeMessages(messages: MastraDBMessage[]): MastraDBMessage[] {
  const seen = new Set<string>();
  return messages.filter(message => {
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}

async function validateBranchPoints(
  memoryStore: MemoryStorage,
  entries: ResolvedThreadLineageEntry[],
): Promise<ThreadBranchSegment[]> {
  const segments = buildThreadBranchSegments(entries);
  const branchIds = entries.flatMap(entry => (entry.branch ? [entry.branch.branchPointMessageId] : []));
  if (branchIds.length === 0) return segments;

  const { messages } = await memoryStore.listMessagesById({ messageIds: [...new Set(branchIds)] });
  const messagesById = new Map(messages.map(message => [message.id, message]));

  for (let index = 1; index < entries.length; index += 1) {
    const branch = entries[index]!.branch!;
    const branchPoint = messagesById.get(branch.branchPointMessageId);
    const ownerIndex = entries.slice(0, index).findIndex(entry => entry.thread.id === branchPoint?.threadId);
    const parentPathSegments = buildThreadBranchSegments(entries.slice(0, index));
    if (
      !branchPoint ||
      ownerIndex < 0 ||
      branchPoint.resourceId !== entries[index]!.thread.resourceId ||
      branchPoint.createdAt.getTime() !== branch.branchPointCreatedAt.getTime() ||
      !tupleInSegment(branchPoint, parentPathSegments[ownerIndex]!)
    ) {
      throw createThreadBranchError('BRANCH_LINEAGE_CORRUPT', 'Stored thread branch point is not reachable.');
    }
  }

  for (const segment of segments) {
    if (!segment.lower) continue;
    const earlier = await memoryStore.listMessages({
      threadId: segment.thread.id,
      resourceId: segment.thread.resourceId,
      perPage: 1,
      includeTotal: false,
      orderBy: { field: 'createdAt', direction: 'DESC' },
      filter: { dateRange: { end: segment.lower.createdAt, endExclusive: true } },
    });
    const lowerCohort = await fetchTimestampCohort(memoryStore, segment, segment.lower.createdAt, undefined);
    if (
      earlier.messages.length > 0 ||
      lowerCohort.some(message => compareMessageTuples(message, segment.lower!) <= 0)
    ) {
      throw createThreadBranchError(
        'BRANCH_LINEAGE_CORRUPT',
        `Thread "${segment.thread.id}" contains a message outside its branch segment.`,
      );
    }
  }

  return segments;
}

export async function getThreadBranchParticipation(
  memoryStore: MemoryStorage,
  threadId: string,
  allThreads?: StorageThreadType[],
  options: { ignorePending?: boolean } = {},
): Promise<{ participant: boolean; thread: StorageThreadType | null }> {
  const threads = allThreads ?? (await listRawThreads(memoryStore));
  const thread = threads.find(candidate => candidate.id === threadId) ?? null;
  if (!thread) return { participant: false, thread: null };
  const branch = parseThreadBranchMetadata(thread);
  if (branch?.state === 'pending') {
    if (options.ignorePending) return { participant: false, thread };
    throw createThreadBranchError('BRANCH_NOT_FOUND', 'The requested thread branch is unavailable.');
  }
  const hasReadyChild = threads.some(candidate => {
    const candidateBranch = parseThreadBranchMetadata(candidate);
    return candidateBranch?.state === 'ready' && candidateBranch.parentThreadId === threadId;
  });
  return { participant: branch?.state === 'ready' || hasReadyChild, thread };
}

async function fetchTimestampCohort(
  memoryStore: MemoryStorage,
  segment: ThreadBranchSegment,
  timestamp: Date,
  metadata: NonNullable<StorageListMessagesInput['filter']>['metadata'],
): Promise<MastraDBMessage[]> {
  const { messages } = await memoryStore.listMessages({
    threadId: segment.thread.id,
    resourceId: segment.thread.resourceId,
    perPage: false,
    orderBy: { field: 'createdAt', direction: 'ASC' },
    filter: {
      ...(metadata ? { metadata } : {}),
      dateRange: { start: timestamp, end: timestamp },
    },
  });
  return messages;
}

async function fetchSegmentMessages(
  memoryStore: MemoryStorage,
  segment: ThreadBranchSegment,
  args: Pick<StorageListMessagesInput, 'filter'>,
  direction: 'ASC' | 'DESC',
  limit: number | false,
): Promise<MastraDBMessage[]> {
  const initialRange = intersectDateRange(segment, args.filter?.dateRange);
  if (!initialRange) return [];

  const messages: MastraDBMessage[] = [];
  const seen = new Set<string>();
  let cursor: Date | undefined;

  while (limit === false || messages.length < limit) {
    const range: DateRange = { ...initialRange };
    if (cursor) {
      if (direction === 'ASC') {
        range.start = cursor;
        range.startExclusive = true;
      } else {
        range.end = cursor;
        range.endExclusive = true;
      }
    }

    const page = await memoryStore.listMessages({
      threadId: segment.thread.id,
      resourceId: segment.thread.resourceId,
      perPage: BRANCH_QUERY_PAGE_SIZE,
      page: 0,
      orderBy: { field: 'createdAt', direction },
      includeTotal: false,
      filter: {
        ...(args.filter?.metadata ? { metadata: args.filter.metadata } : {}),
        dateRange: range,
      },
    });
    if (page.messages.length === 0) break;

    const boundary = page.messages.at(-1)!.createdAt;
    const cohort = await fetchTimestampCohort(memoryStore, segment, boundary, args.filter?.metadata);
    const batch = dedupeMessages([...page.messages, ...cohort]).filter(
      message => tupleInSegment(message, segment) && messageMatchesRequestedDateRange(message, args.filter?.dateRange),
    );
    for (const message of sortMessages(batch, direction)) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      messages.push(message);
    }

    cursor = boundary;
    if (page.messages.length < BRANCH_QUERY_PAGE_SIZE) break;
  }

  return sortMessages(messages, direction).slice(0, limit === false ? undefined : limit);
}

async function countSegmentMessages(
  memoryStore: MemoryStorage,
  segment: ThreadBranchSegment,
  filter: StorageListMessagesInput['filter'],
): Promise<number> {
  const dateRange = intersectDateRange(segment, filter?.dateRange);
  if (!dateRange) return 0;
  const result = await memoryStore.listMessages({
    threadId: segment.thread.id,
    resourceId: segment.thread.resourceId,
    perPage: 1,
    page: 0,
    orderBy: { field: 'createdAt', direction: 'ASC' },
    filter: { ...(filter?.metadata ? { metadata: filter.metadata } : {}), dateRange },
  });
  let total = result.total;

  const excludedIds = new Set<string>();
  const boundaryTimes = new Set(
    [segment.lower, segment.upper].flatMap(boundary => (boundary ? [boundary.createdAt.getTime()] : [])),
  );
  for (const boundaryTime of boundaryTimes) {
    const cohort = await fetchTimestampCohort(memoryStore, segment, new Date(boundaryTime), filter?.metadata);
    for (const message of cohort) {
      if (messageMatchesRequestedDateRange(message, filter?.dateRange) && !tupleInSegment(message, segment)) {
        excludedIds.add(message.id);
      }
    }
  }

  return Math.max(0, total - excludedIds.size);
}

async function resolveIncludedMessages(
  memoryStore: MemoryStorage,
  segments: ThreadBranchSegment[],
  include: StorageListMessagesInput['include'],
): Promise<MastraDBMessage[]> {
  if (!include?.length) return [];
  const { messages: targets } = await memoryStore.listMessagesById({
    messageIds: [...new Set(include.map(item => item.id))],
  });
  const targetsById = new Map(targets.map(message => [message.id, message]));
  const included: MastraDBMessage[] = [];
  const seen = new Set<string>();

  for (const item of include) {
    const target = targetsById.get(item.id);
    if (!target || !segments.some(segment => tupleInSegment(target, segment))) continue;

    const previousCount = item.withPreviousMessages ?? 0;
    const nextCount = item.withNextMessages ?? 0;
    const previous = previousCount
      ? sortMessages(
          dedupeMessages(
            (
              await Promise.all(
                segments.map(segment =>
                  fetchSegmentMessages(
                    memoryStore,
                    segment,
                    { filter: { dateRange: { end: target.createdAt } } },
                    'DESC',
                    previousCount + 1,
                  ),
                ),
              )
            )
              .flat()
              .filter(message => compareMessageTuples(message, target) < 0),
          ),
          'DESC',
        )
          .slice(0, previousCount)
          .reverse()
      : [];
    const next = nextCount
      ? sortMessages(
          dedupeMessages(
            (
              await Promise.all(
                segments.map(segment =>
                  fetchSegmentMessages(
                    memoryStore,
                    segment,
                    { filter: { dateRange: { start: target.createdAt } } },
                    'ASC',
                    nextCount + 1,
                  ),
                ),
              )
            )
              .flat()
              .filter(message => compareMessageTuples(message, target) > 0),
          ),
          'ASC',
        ).slice(0, nextCount)
      : [];

    for (const message of [...previous, target, ...next]) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      included.push(message);
    }
  }

  return included;
}

async function queryPhysicalMessagesExcludingPending(
  memoryStore: MemoryStorage,
  args: StorageListMessagesInput,
  pendingThreadIds: Set<string>,
): Promise<StorageListMessagesOutput> {
  const result = await memoryStore.listMessages(args);
  return {
    ...result,
    messages: result.messages.filter(message => !message.threadId || !pendingThreadIds.has(message.threadId)),
  };
}

export async function queryThreadMessages(
  memoryStore: MemoryStorage,
  args: StorageListMessagesInput,
): Promise<StorageListMessagesOutput> {
  const allThreads = await listRawThreads(memoryStore);
  const pendingThreadIds = new Set(
    allThreads.flatMap(thread => (parseThreadBranchMetadata(thread)?.state === 'pending' ? [thread.id] : [])),
  );

  if (Array.isArray(args.threadId)) {
    const visibleThreadIds = args.threadId.filter(threadId => !pendingThreadIds.has(threadId));
    for (const threadId of visibleThreadIds) {
      if (
        (await getThreadBranchParticipation(memoryStore, threadId, allThreads, { ignorePending: true })).participant
      ) {
        throw createThreadBranchError(
          'BRANCH_INVALID_REQUEST',
          'Branch-tree message reads require exactly one threadId.',
        );
      }
    }
    if (visibleThreadIds.length === 0) {
      return { messages: [], total: 0, page: args.page ?? 0, perPage: args.perPage ?? 40, hasMore: false };
    }
    return queryPhysicalMessagesExcludingPending(
      memoryStore,
      { ...args, threadId: visibleThreadIds },
      pendingThreadIds,
    );
  }

  const threadId = args.threadId;
  const participation = await getThreadBranchParticipation(memoryStore, threadId, allThreads);
  if (!participation.thread) return queryPhysicalMessagesExcludingPending(memoryStore, args, pendingThreadIds);
  if (!participation.participant) return queryPhysicalMessagesExcludingPending(memoryStore, args, pendingThreadIds);
  if (args.resourceId && args.resourceId !== participation.thread.resourceId) {
    return { messages: [], total: 0, page: args.page ?? 0, perPage: args.perPage ?? 40, hasMore: false };
  }

  const page = args.page ?? 0;
  const perPage = args.perPage ?? 40;
  if (!Number.isInteger(page) || page < 0 || (perPage !== false && (!Number.isInteger(perPage) || perPage < 0))) {
    throw createThreadBranchError('BRANCH_INVALID_REQUEST', 'Invalid message pagination request.');
  }

  const entries = await resolveThreadLineageEntries(memoryStore, threadId);
  const segments = (await validateBranchPoints(memoryStore, entries)).filter(
    segment => !segment.lower || !segment.upper || compareMessageTuples(segment.upper, segment.lower) > 0,
  );
  const direction = args.orderBy?.direction ?? 'ASC';
  const offset = perPage === false ? 0 : page * perPage;
  const needed = perPage === false ? false : offset + perPage + 1;
  const fetched = await Promise.all(
    segments.map(segment => fetchSegmentMessages(memoryStore, segment, args, direction, needed)),
  );
  const merged = sortMessages(dedupeMessages(fetched.flat()), direction);
  const mainMessages = perPage === false ? merged : perPage === 0 ? [] : merged.slice(offset, offset + perPage);
  const includedMessages = await resolveIncludedMessages(memoryStore, segments, args.include);
  const messages = sortMessages(dedupeMessages([...mainMessages, ...includedMessages]), direction);

  const total =
    perPage === 0
      ? 0
      : args.includeTotal === false
        ? 0
        : (await Promise.all(segments.map(segment => countSegmentMessages(memoryStore, segment, args.filter)))).reduce(
            (sum, count) => sum + count,
            0,
          );
  const hasMore =
    perPage === false || perPage === 0
      ? false
      : args.includeTotal === false
        ? merged.length > offset + perPage
        : offset + perPage < total;

  return { messages, total, page, perPage, hasMore };
}

export async function assertResourceHasNoReadyBranches(memoryStore: MemoryStorage, resourceId: string): Promise<void> {
  const threads = await listRawThreads(memoryStore, resourceId);
  if (threads.some(thread => parseThreadBranchMetadata(thread)?.state === 'ready')) {
    throw createThreadBranchError(
      'BRANCH_INVALID_REQUEST',
      'Resource-wide message reads require a threadId when shared-history branches exist.',
    );
  }
}
