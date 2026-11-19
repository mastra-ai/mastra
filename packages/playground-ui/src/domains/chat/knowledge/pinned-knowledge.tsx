import { useState } from 'react';
import { KnowledgePageLink } from './knowledge-links';
import type { PinnedKnowledge, PinnedRow } from './pinned-knowledge-data';
import { ActivityItem } from '@/ds/components/ai/activity';
import { Badge } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';
import { IconPin } from '@/ds/icons/central/IconPin';

const CHANGE_MARK = { add: '+', change: '~', remove: '−' } as const;
const CHANGE_LABEL = { add: 'Added', change: 'Changed', remove: 'Removed' } as const;

function summary({ mode, rows }: PinnedKnowledge): string {
  if (mode === 'snapshot') return rows.length === 1 ? '1 page' : `${rows.length} pages`;
  const count = (change: PinnedRow['change']) => rows.filter(row => row.change === change).length;
  return (['add', 'change', 'remove'] as const)
    .filter(change => count(change) > 0)
    .map(change => `${CHANGE_MARK[change]}${count(change)}`)
    .join(' ');
}

/**
 * Pages a listing names: its `- ` entries plus the count in its closing "…and N more" line.
 * Core ends a listing cut short with a bare "…and more", so the count is then only a lower bound.
 */
function listedPageCount(text: string): { count: number; atLeast: boolean } {
  const lines = text.split('\n').map(line => line.trim());
  const listed = lines.filter(line => line.startsWith('- ')).length;
  const more = lines.map(line => /^…and (\d+) more/.exec(line)?.[1]).find(Boolean);
  return {
    count: listed + (more ? Number(more) : 0),
    atLeast: lines.some(line => line.startsWith('…and more')),
  };
}

function toggleLabel(row: PinnedRow, open: boolean): string {
  if (!row.listOf) return open ? 'Hide text' : 'Text';
  if (open) return 'Hide pages';
  const { count, atLeast } = listedPageCount(row.text ?? '');
  if (count === 0) return 'Show pages';
  if (atLeast) return `Show ${count}+ pages`;
  return count === 1 ? 'Show 1 page' : `Show ${count} pages`;
}

function PinnedRowItem({ row }: { row: PinnedRow }) {
  const [open, setOpen] = useState(false);
  const removed = row.change === 'remove';
  return (
    <li className="flex flex-col gap-1" data-testid="pinned-knowledge-row" data-change={row.change}>
      <div className="flex min-w-0 items-baseline gap-2">
        {row.change ? (
          <span
            aria-label={CHANGE_LABEL[row.change]}
            className={`w-3 shrink-0 text-center ${removed ? 'text-muted-foreground' : 'text-foreground'}`}
          >
            <Txt as="span" variant="label">
              {CHANGE_MARK[row.change]}
            </Txt>
          </span>
        ) : null}
        <Txt as="span" variant="label" className={`min-w-0 truncate ${removed ? 'line-through opacity-70' : ''}`}>
          <KnowledgePageLink pageId={row.listOf ?? row.id}>{row.name ?? 'A pinned page'}</KnowledgePageLink>
        </Txt>
        {row.listOf ? <Badge size="xs">Listing</Badge> : null}
        {row.scope ? (
          <Txt as="span" variant="meta" tone="muted" className="truncate">
            {row.scope}
          </Txt>
        ) : null}
        {row.text && !removed ? (
          <button
            type="button"
            aria-expanded={open}
            className="ml-auto shrink-0 rounded px-1 text-muted-foreground hover:bg-fill hover:text-foreground"
            onClick={() => setOpen(value => !value)}
          >
            <Txt as="span" variant="meta">
              {toggleLabel(row, open)}
              {row.listOf ? <span aria-hidden>{open ? ' ▴' : ' ▾'}</span> : null}
            </Txt>
          </button>
        ) : null}
      </div>
      {open && row.text ? (
        <Txt
          variant="caption"
          tone="muted"
          className="ml-5 break-words whitespace-pre-wrap"
          data-testid={row.listOf ? 'pinned-knowledge-listing' : undefined}
        >
          {row.text}
        </Txt>
      ) : null}
    </li>
  );
}

/**
 * Pinned Knowledge as the agent received it: a snapshot lists every pinned page, a delta lists the pages
 * added, changed or removed since. Each page links to the Knowledge viewer; its delivered text opens below it.
 */
export function PinnedKnowledgeActivity({ pinned, defaultOpen }: { pinned: PinnedKnowledge; defaultOpen?: boolean }) {
  const label = pinned.mode === 'snapshot' ? 'Pinned knowledge' : 'Pinned knowledge updated';
  return (
    <ActivityItem
      icon={<IconPin className="text-badge-amber-indicator" aria-hidden />}
      label={label}
      detail={summary(pinned)}
      badges={<Badge size="xs">{pinned.mode}</Badge>}
      defaultOpen={defaultOpen}
      data-signal-kind="state"
      data-testid="pinned-knowledge"
      aria-label={`Signal: ${label}`}
    >
      <div className="flex flex-col gap-2">
        {pinned.rows.length ? (
          <ul className="flex flex-col gap-1.5">
            {pinned.rows.map(row => (
              <PinnedRowItem key={`${row.change ?? 'pin'}-${row.id}`} row={row} />
            ))}
          </ul>
        ) : pinned.overflow ? null : (
          <Txt variant="meta" tone="muted">
            No pinned pages
          </Txt>
        )}
        {pinned.overflow ? (
          <Txt variant="meta" tone="muted">
            {pinned.overflow}
          </Txt>
        ) : null}
      </div>
    </ActivityItem>
  );
}
