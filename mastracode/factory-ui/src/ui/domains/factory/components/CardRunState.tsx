import { Txt } from '@mastra/playground-ui/components/Txt';

import type { InstalledBoardInfo } from '../../../../api/types';
import { boardOf } from '../boardFlow';
import { phaseLabel } from '../boardStages';
import { cardRunStatePresentation } from '../cardRunState';
import { useCardRunState } from '../hooks/useCardRunState';
import type { WorkItem } from '../services/workItems';

/** What the card's board run says it is doing; nothing on a board engine that records none. */
export function CardRunState({
  item,
  factoryId,
  boards,
}: {
  item: WorkItem;
  factoryId: string;
  boards: readonly InstalledBoardInfo[] | undefined;
}) {
  const { data: runState } = useCardRunState(factoryId, item.id);
  if (!runState) return null;
  const shown = cardRunStatePresentation(runState);
  const phase = runState.phase ? phaseLabel(boardOf(boards, item), runState.phase) : undefined;

  return (
    <section aria-label="Automation" className="flex flex-col gap-1 px-2">
      <div className="flex items-baseline gap-2">
        <Txt variant="label" tone="ink" className="m-0">
          {shown.label}
        </Txt>
        {phase ? (
          <Txt variant="caption" tone="muted" className="m-0">
            {phase}
          </Txt>
        ) : null}
      </div>
      <Txt
        variant="body-sm"
        tone={shown.needsAttention ? undefined : 'muted'}
        className={shown.needsAttention ? 'text-destructive-foreground m-0' : 'm-0'}
      >
        {shown.detail}
      </Txt>
      {shown.facts.map(fact => (
        <Txt key={fact} variant="caption" tone="muted" className="m-0">
          {fact}
        </Txt>
      ))}
    </section>
  );
}
