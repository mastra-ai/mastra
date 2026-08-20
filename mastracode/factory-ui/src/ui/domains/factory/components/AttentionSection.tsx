import { Button } from '@mastra/playground-ui/components/Button';
import { useState } from 'react';

import { formatDuration } from '../../../../lib/date/formatDuration';
import type { AttentionReasonId, AttentionRow } from '../attention';
import { ATTENTION_REASONS, needsPerson } from '../attention';
import { AttentionList } from './AttentionList';
import { Chip, ChipRow } from './Chips';

const PAGE = 15;

/** The cards a person has to touch, counted and sliced by why. */
export function AttentionSection({ rows }: { rows: AttentionRow[] }) {
  const [reason, setReason] = useState<AttentionReasonId | 'all'>('all');
  const [shown, setShown] = useState(PAGE);

  const waiting = rows.filter(needsPerson);
  const oldest = waiting.length === 0 ? undefined : Math.max(...waiting.map(row => row.entry.ageSeconds));
  const filters = ATTENTION_REASONS.filter(entry => rows.some(row => row.reason === entry));
  const visible = reason === 'all' ? rows : rows.filter(row => row.reason.id === reason);

  const pick = (next: AttentionReasonId | 'all') => {
    setReason(next);
    setShown(PAGE);
  };

  return (
    <section className="flex flex-col gap-4" aria-label="Waiting on a person">
      {waiting.length > 0 ? (
        <h2 className="text-icon3 text-ui-md m-0 flex flex-wrap items-baseline gap-x-3 font-normal">
          <span className="text-icon6 text-[1.75rem] leading-none font-medium tracking-[-0.04em] tabular-nums">
            {waiting.length}
          </span>
          {waiting.length === 1 ? 'card is waiting on a person' : 'cards are waiting on a person'}
          {oldest === undefined ? null : (
            <span className="text-icon2 text-ui-xs font-mono tabular-nums">oldest {formatDuration(oldest * 1000)}</span>
          )}
        </h2>
      ) : null}

      {filters.length > 1 ? (
        <ChipRow label="Attention filter">
          <Chip active={reason === 'all'} onClick={() => pick('all')}>
            All {rows.length}
          </Chip>
          {filters.map(entry => (
            <Chip key={entry.id} active={reason === entry.id} onClick={() => pick(entry.id)}>
              {entry.short} {rows.filter(row => row.reason === entry).length}
            </Chip>
          ))}
        </ChipRow>
      ) : null}

      <AttentionList rows={visible} limit={shown} />

      {visible.length > shown ? (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setShown(shown + PAGE)}>
          Show {Math.min(PAGE, visible.length - shown)} more
        </Button>
      ) : null}
    </section>
  );
}
