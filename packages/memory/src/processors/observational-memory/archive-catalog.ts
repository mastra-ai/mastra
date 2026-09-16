import type { ObservationArchiveEntry } from '@mastra/core/storage';

import { safeSlice } from './string-utils';

const OPEN_TAG = '<archived-observations>';
const CLOSE_TAG = '</archived-observations>';
const SHORTEST_HIDDEN_MARKER = '<hidden-archive-range />';

export interface RenderObservationArchiveCatalogInput {
  archives: ObservationArchiveEntry[];
  hasMore: boolean;
  maxTokens: number;
  countTokens: (text: string) => number;
}

export interface RenderObservationArchiveCatalogResult {
  text?: string;
  budgetFull: boolean;
}

type CatalogRow = {
  archive: ObservationArchiveEntry;
  group: ObservationArchiveEntry['groups'][number];
};

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function dateSpan(row: CatalogRow): string {
  const observedAt = row.group.observedAt;
  if (!observedAt) return row.archive.archivedAt.toISOString();
  return `${observedAt.from.toISOString()}..${observedAt.to.toISOString()}`;
}

function formatRow(row: CatalogRow, summary = row.group.summary): string {
  const sourceThreadId = row.group.sourceThreadId ?? row.archive.threadId ?? undefined;
  const messageRange = row.group.sourceUnavailable ? 'unavailable' : (row.group.messageRange ?? 'unavailable');
  const attributes = [
    `archive-id="${escapeAttribute(row.archive.archiveId)}"`,
    `generation="${row.archive.generationCount}"`,
    `group-id="${escapeAttribute(row.group.groupId)}"`,
    `archived-at="${row.archive.archivedAt.toISOString()}"`,
    `date-span="${dateSpan(row)}"`,
    sourceThreadId ? `thread-id="${escapeAttribute(sourceThreadId)}"` : undefined,
    `observation-range="${row.group.textStart}:${row.group.textEnd}"`,
    `message-range="${escapeAttribute(messageRange)}"`,
  ].filter(Boolean);

  return `<archived-observation ${attributes.join(' ')}>${summary}</archived-observation>`;
}

function fromHiddenMarker(row: CatalogRow): string {
  return `<hidden-archive-range from-archived-at="${row.archive.archivedAt.toISOString()}" from-generation="${row.archive.generationCount}" from-archive="${escapeAttribute(row.archive.archiveId)}" from-group="${escapeAttribute(row.group.groupId)}" />`;
}

function afterHiddenMarker(archive: ObservationArchiveEntry): string {
  return `<hidden-archive-range after-archived-at="${archive.archivedAt.toISOString()}" after-generation="${archive.generationCount}" after-archive="${escapeAttribute(archive.archiveId)}" />`;
}

function assemble(lines: string[], marker?: string): string {
  return [OPEN_TAG, ...lines, ...(marker ? [marker] : []), CLOSE_TAG].join('\n');
}

export function canRenderObservationArchiveCatalog(maxTokens: number, countTokens: (text: string) => number): boolean {
  return countTokens(assemble([], SHORTEST_HIDDEN_MARKER)) <= maxTokens;
}

function truncateRowToFit(
  row: CatalogRow,
  lines: string[],
  marker: string | undefined,
  maxTokens: number,
  countTokens: (text: string) => number,
): string | undefined {
  const summary = row.group.summary;
  let best: string | undefined;

  for (let end = 0; end <= summary.length; end += 1) {
    const prefix = safeSlice(summary, end);
    const truncated = prefix.length < summary.length;
    const candidateRow = formatRow(row, `${prefix}${truncated ? '…' : ''}`);
    if (countTokens(assemble([...lines, candidateRow], marker)) <= maxTokens) {
      best = candidateRow;
    }
  }

  return best;
}

/**
 * Render a newest-first archive catalog under a strict token ceiling.
 *
 * The caller may invoke this after each bounded storage page. `budgetFull` means
 * no older page should be fetched. When storage reports more rows, the catalog
 * retains an exact archive/generation boundary marker rather than loading them.
 */
export function renderObservationArchiveCatalog(
  input: RenderObservationArchiveCatalogInput,
): RenderObservationArchiveCatalogResult {
  const { archives, hasMore, maxTokens, countTokens } = input;
  if (!canRenderObservationArchiveCatalog(maxTokens, countTokens)) {
    return { budgetFull: true };
  }
  if (archives.length === 0) {
    return { budgetFull: false };
  }

  const rows: CatalogRow[] = archives.flatMap(archive => archive.groups.map(group => ({ archive, group })));
  if (rows.length === 0) {
    return { budgetFull: false };
  }

  const lines: string[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const nextRow = rows[index + 1];
    const marker = nextRow
      ? fromHiddenMarker(nextRow)
      : hasMore
        ? afterHiddenMarker(archives[archives.length - 1]!)
        : undefined;
    const fullRow = formatRow(row);

    if (countTokens(assemble([...lines, fullRow], marker)) <= maxTokens) {
      lines.push(fullRow);
      continue;
    }

    const truncatedRow = truncateRowToFit(row, lines, marker, maxTokens, countTokens);
    if (truncatedRow) {
      lines.push(truncatedRow);
      return { text: assemble(lines, marker), budgetFull: true };
    }

    const hiddenMarker = fromHiddenMarker(row);
    const markerOnly = assemble(lines, hiddenMarker);
    if (countTokens(markerOnly) > maxTokens) {
      return { budgetFull: true };
    }
    return { text: markerOnly, budgetFull: true };
  }

  const marker = hasMore ? afterHiddenMarker(archives[archives.length - 1]!) : undefined;
  const text = assemble(lines, marker);
  return countTokens(text) <= maxTokens ? { text, budgetFull: false } : { budgetFull: true };
}
