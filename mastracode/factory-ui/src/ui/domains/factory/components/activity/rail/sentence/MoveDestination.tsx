import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight } from 'lucide-react';

import { StageBadge } from '../../../StageBadge';

/** Steps beyond this fold into a count, so a long chain cannot push the title out. */
const CHAIN_SHOWN = 2;

export function MoveDestination({ stages }: { stages: string[] }) {
  const folded = stages.length - CHAIN_SHOWN;
  const shown = folded > 0 ? stages.slice(-CHAIN_SHOWN) : stages;

  return (
    <>
      <Txt as="span" variant="caption" tone="muted" className="shrink-0">
        to
      </Txt>
      <span className="flex shrink-0 items-center gap-1">
        {folded > 0 ? (
          <Txt as="span" variant="meta" tone="muted" className="tabular-nums">
            +{folded}
          </Txt>
        ) : null}
        {shown.map((stage, index) => (
          <span key={`${stage}-${index}`} className="flex items-center gap-1">
            {index > 0 || folded > 0 ? (
              <ChevronRight size={11} className="text-placeholder shrink-0" aria-hidden />
            ) : null}
            <StageBadge stage={stage} />
          </span>
        ))}
      </span>
    </>
  );
}
