import { createHash } from 'node:crypto';

import type {
  ArchivedObservationGroup,
  CreateObservationArchiveGenerationInput,
  ObservationGroupMetadata,
  ObservationalMemoryRecord,
} from '@mastra/core/storage';

import { ARCHIVE_CATALOG_SUMMARY_MAX_CHARS } from './constants';
import { parseObservationGroupSpans } from './observation-groups';
import type { ResolvedObservationArchiveConfig } from './types';

interface ArchiveSegment {
  start: number;
  end: number;
  text: string;
  metadata: ObservationGroupMetadata;
}

interface ThreadSpan {
  start: number;
  end: number;
}

export type ObservationArchivePlan =
  | { status: 'below-threshold' }
  | { status: 'no-progress'; key: string }
  | { status: 'ready'; input: CreateObservationArchiveGenerationInput };

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function createArchiveCatalogLabel(
  summary: string | undefined,
  range: string,
  observedAt?: { from: Date; to: Date },
): { persisted: string; searchable: string } {
  const fallbackDate = observedAt?.from.toISOString().slice(0, 10);
  const fallback = fallbackDate ? `Conversation observed on ${fallbackDate} (${range})` : `Conversation range ${range}`;
  const normalized = (summary ?? '').replace(/\s+/g, ' ').trim() || fallback;
  const searchable =
    normalized.length > ARCHIVE_CATALOG_SUMMARY_MAX_CHARS
      ? `${normalized.slice(0, ARCHIVE_CATALOG_SUMMARY_MAX_CHARS - 3)}...`
      : normalized;
  const escaped = searchable
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  if (escaped.length <= ARCHIVE_CATALOG_SUMMARY_MAX_CHARS) {
    return { persisted: escaped, searchable };
  }

  let prefix = escaped.slice(0, ARCHIVE_CATALOG_SUMMARY_MAX_CHARS - 3);
  const lastAmpersand = prefix.lastIndexOf('&');
  if (lastAmpersand > prefix.lastIndexOf(';')) {
    prefix = prefix.slice(0, lastAmpersand);
  }
  return { persisted: `${prefix}...`, searchable };
}

function getThreadSpans(observations: string): ThreadSpan[] {
  const spans: ThreadSpan[] = [];
  const pattern = /<thread\b[^>]*>[\s\S]*?<\/thread>/g;
  for (const match of observations.matchAll(pattern)) {
    if (match.index === undefined) continue;
    spans.push({ start: match.index, end: match.index + match[0].length });
  }
  return spans;
}

function splitLegacySpan(start: number, end: number, observations: string): Array<{ start: number; end: number }> {
  if (start >= end) return [];

  const boundaries = new Set([start, end]);
  const text = observations.slice(start, end);
  const structuralPattern = /<thread\b[^>]*>|<\/thread>/g;
  for (const match of text.matchAll(structuralPattern)) {
    if (match.index === undefined) continue;
    const absoluteStart = start + match.index;
    boundaries.add(absoluteStart);
    if (match[0] === '</thread>') {
      boundaries.add(absoluteStart + match[0].length);
    }
  }

  const sorted = [...boundaries].sort((a, b) => a - b);
  return sorted.slice(0, -1).map((segmentStart, index) => ({ start: segmentStart, end: sorted[index + 1]! }));
}

function inferLegacySourceThreadId(
  segment: { start: number; end: number },
  threadSpans: ThreadSpan[],
  explicitSegments: ArchiveSegment[],
): string | undefined {
  const container = threadSpans.find(thread => segment.start >= thread.start && segment.end <= thread.end);
  if (!container) return undefined;
  return explicitSegments.find(explicit => explicit.start >= container.start && explicit.end <= container.end)?.metadata
    .sourceThreadId;
}

function createLegacyMetadata(
  record: ObservationalMemoryRecord,
  observations: string,
  start: number,
  end: number,
  countTokens: (text: string) => number,
  stableContext: string,
  sourceThreadId?: string,
): ObservationGroupMetadata {
  const text = observations.slice(start, end);
  const byteStart = Buffer.byteLength(observations.slice(0, start), 'utf8');
  const byteEnd = byteStart + Buffer.byteLength(text, 'utf8');
  const contentDigest = digest(text);
  const groupId = `legacy-${digest(`${record.id}:${byteStart}:${byteEnd}:${stableContext}:${contentDigest}`).slice(0, 24)}`;
  const existing = record.observationGroups?.find(group => group.groupId === groupId);
  if (existing) return existing;

  const range = `bytes ${byteStart}-${byteEnd}`;
  const label = createArchiveCatalogLabel(
    undefined,
    range,
    record.lastObservedAt
      ? {
          from: new Date(record.lastObservedAt),
          to: new Date(record.lastObservedAt),
        }
      : undefined,
  );

  return {
    groupId,
    summary: label.persisted,
    searchText: `${label.searchable}\n${text}`.normalize('NFKC').toLowerCase(),
    sourceUnavailable: true,
    kind: 'legacy',
    legacyTextLength: text.length,
    legacyTextDigest: contentDigest,
    sourceThreadId,
    tokenCount: countTokens(text),
  };
}

function buildArchiveSegments(
  record: ObservationalMemoryRecord,
  countTokens: (text: string) => number,
): ArchiveSegment[] {
  const observations = record.activeObservations;
  const metadataById = new Map((record.observationGroups ?? []).map(group => [group.groupId, group]));
  const explicitSpans = parseObservationGroupSpans(observations);
  const explicitSegments: ArchiveSegment[] = explicitSpans.map(group => {
    const existing = metadataById.get(group.id);
    const label = createArchiveCatalogLabel(undefined, group.range);
    return {
      start: group.start,
      end: group.end,
      text: group.text,
      metadata: existing ?? {
        groupId: group.id,
        summary: label.persisted,
        searchText: `${label.searchable}\n${group.content}`.normalize('NFKC').toLowerCase(),
        messageRange: group.range,
        sourceUnavailable: true,
        kind: group.kind === 'reflection' ? 'reflection' : 'observation',
        tokenCount: countTokens(group.text),
      },
    };
  });
  const threadSpans = getThreadSpans(observations);
  const segments: ArchiveSegment[] = [];
  const persistedMetadata = record.observationGroups ?? [];
  let cursor = 0;

  const getPersistedLegacyGroups = (previousId: string | undefined, nextId: string | undefined) => {
    const start = previousId ? Math.max(0, persistedMetadata.findIndex(group => group.groupId === previousId) + 1) : 0;
    const nextIndex = nextId ? persistedMetadata.findIndex(group => group.groupId === nextId) : -1;
    const end = nextIndex >= start ? nextIndex : persistedMetadata.length;
    return persistedMetadata.slice(start, end).filter(group => group.kind === 'legacy');
  };

  const appendLegacySegments = (
    start: number,
    end: number,
    previousId: string | undefined,
    nextId: string | undefined,
  ) => {
    let legacyCursor = start;
    let stableIndex = 0;
    for (const metadata of getPersistedLegacyGroups(previousId, nextId)) {
      if (!metadata.legacyTextLength || !metadata.legacyTextDigest) break;
      const legacyEnd = legacyCursor + metadata.legacyTextLength;
      const text = observations.slice(legacyCursor, legacyEnd);
      if (legacyEnd > end || digest(text) !== metadata.legacyTextDigest) break;
      segments.push({ start: legacyCursor, end: legacyEnd, text, metadata });
      legacyCursor = legacyEnd;
      stableIndex += 1;
    }

    for (const [legacyIndex, legacy] of splitLegacySpan(legacyCursor, end, observations).entries()) {
      const text = observations.slice(legacy.start, legacy.end);
      segments.push({
        ...legacy,
        text,
        metadata: createLegacyMetadata(
          record,
          observations,
          legacy.start,
          legacy.end,
          countTokens,
          `${previousId ?? 'START'}:${stableIndex + legacyIndex}`,
          inferLegacySourceThreadId(legacy, threadSpans, explicitSegments),
        ),
      });
    }
  };

  for (const [explicitIndex, explicit] of explicitSegments.entries()) {
    const previousId = explicitSegments[explicitIndex - 1]?.metadata.groupId;
    appendLegacySegments(cursor, explicit.start, previousId, explicit.metadata.groupId);
    segments.push(explicit);
    cursor = explicit.end;
  }

  appendLegacySegments(cursor, observations.length, explicitSegments.at(-1)?.metadata.groupId, undefined);

  if (segments.length === 0 && observations) {
    segments.push({
      start: 0,
      end: observations.length,
      text: observations,
      metadata: createLegacyMetadata(record, observations, 0, observations.length, countTokens, 'START:0'),
    });
  }

  return segments;
}

function isInsideThreadSpan(boundary: number, threadSpans: ThreadSpan[]): boolean {
  return threadSpans.some(thread => boundary > thread.start && boundary < thread.end);
}

export function planObservationArchive(
  record: ObservationalMemoryRecord,
  config: ResolvedObservationArchiveConfig,
  countTokens: (text: string) => number,
  archivedAt = new Date(),
): ObservationArchivePlan {
  if (!record.activeObservations || record.observationTokenCount < config.afterTokens) {
    return { status: 'below-threshold' };
  }

  const segments = buildArchiveSegments(record, countTokens);
  if (segments.length === 0) {
    return { status: 'below-threshold' };
  }

  let retainedStart = segments.length - 1;
  let retainedTokens = countTokens(segments[retainedStart]!.text);
  while (retainedStart > 0 && retainedTokens < config.keepTokens) {
    retainedStart -= 1;
    retainedTokens += countTokens(segments[retainedStart]!.text);
  }

  const threadSpans = getThreadSpans(record.activeObservations);
  while (retainedStart > 0 && isInsideThreadSpan(segments[retainedStart]!.start, threadSpans)) {
    retainedStart -= 1;
  }

  const boundary = segments[retainedStart]!.start;
  if (boundary <= 0) {
    const newest = [...segments].reverse().find(segment => segment.text.trim()) ?? segments[segments.length - 1]!;
    return {
      status: 'no-progress',
      key: digest(`${newest.metadata.groupId}:${digest(newest.text)}`),
    };
  }

  const retiredObservations = record.activeObservations.slice(0, boundary);
  const retainedObservations = record.activeObservations.slice(boundary);
  const retiredSegments = segments.filter(segment => segment.end <= boundary);
  const retainedSegments = segments.filter(segment => segment.start >= boundary);
  if (retiredSegments.length === 0 || retainedSegments.length === 0) {
    const newest = segments[segments.length - 1]!;
    return { status: 'no-progress', key: digest(`${newest.metadata.groupId}:${digest(newest.text)}`) };
  }

  const retiredGroups: ArchivedObservationGroup[] = retiredSegments.map(segment => ({
    ...segment.metadata,
    textStart: segment.start,
    textEnd: segment.end,
  }));
  const retainedGroups = retainedSegments.map(segment => segment.metadata);
  const contentDigest = digest(retiredObservations);
  const archiveId = `oma_${digest(
    `${record.id}:${record.generationCount}:${record.writeEpoch ?? 0}:${contentDigest}`,
  ).slice(0, 32)}`;

  return {
    status: 'ready',
    input: {
      currentRecordId: record.id,
      expectedGenerationCount: record.generationCount,
      expectedWriteEpoch: record.writeEpoch ?? 0,
      archiveId,
      archivedAt,
      contentDigest,
      retiredObservations,
      retiredObservationTokenCount: countTokens(retiredObservations),
      retiredGroups,
      retainedObservations,
      retainedObservationTokenCount: countTokens(retainedObservations),
      retainedGroups,
    },
  };
}
