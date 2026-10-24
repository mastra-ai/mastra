import { Txt } from '@mastra/playground-ui/components/Txt';
import { Fragment } from 'react';
import { sortLabelCounts } from '../utils/score-labels';
import type { LabelCounts } from '../utils/score-labels';

/** Label distribution of one scorer, `failing 1 · exemplary 5`, in the caption/count style of the run stats. */
export function ScoreLabelCounts({ counts, className }: { counts: LabelCounts; className?: string }) {
  return (
    <Txt as="span" variant="caption" className={className}>
      {sortLabelCounts(counts).map(([label, count], index) => (
        <Fragment key={label}>
          {index > 0 && ' · '}
          {label}{' '}
          <Txt as="b" variant="column" tone="muted">
            {count}
          </Txt>
        </Fragment>
      ))}
    </Txt>
  );
}
