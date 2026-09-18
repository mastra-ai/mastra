import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { GitPullRequestArrow } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';

import type { BoardCandidate } from '../boardCandidates';
import { ColumnReveal } from '../components/ColumnReveal';
import type { WorkItem } from '../services/workItems';
import { groupReviewCards, reviewCardKey, reviewCards } from './reviewGroups';

export function ReviewColumnCards({
  workItems,
  candidates,
  targetItemId,
  renderWorkItem,
  renderCandidate,
}: {
  workItems: readonly WorkItem[];
  candidates: readonly BoardCandidate[];
  targetItemId?: string;
  renderWorkItem: (item: WorkItem) => ReactNode;
  renderCandidate: (candidate: BoardCandidate) => ReactNode;
}) {
  const headingPrefix = useId();
  const cards = groupReviewCards(reviewCards(workItems, candidates)).flatMap(group => group.cards);
  return (
    <ColumnReveal items={cards} pinned={card => card.kind === 'work-item' && card.value.id === targetItemId}>
      {visibleCards =>
        groupReviewCards(visibleCards).flatMap(({ reviewGroup, cards }, groupIndex) =>
          cards.map((card, index) => {
            const firstInGroup = index === 0;
            const lastInGroup = index === cards.length - 1;
            const headingId = reviewGroup ? `${headingPrefix}-${groupIndex}` : undefined;
            return (
              <div
                key={reviewCardKey(card)}
                aria-describedby={headingId}
                data-review-group={reviewGroup?.key}
                className={cn(
                  'relative min-w-0',
                  reviewGroup &&
                    'before:border-neutral3/30 before:pointer-events-none before:absolute before:-inset-x-0.5 before:-top-0.5 before:-bottom-3 before:border-x before:border-dashed',
                  reviewGroup && firstInGroup && 'before:rounded-t-xl before:border-t',
                  reviewGroup &&
                    lastInGroup &&
                    String.raw`before:-bottom-0.5 before:rounded-b-[calc(var(--radius-card)+var(--spacing-0\_5))] before:border-b`,
                )}
              >
                {reviewGroup && firstInGroup && (
                  <div className="text-icon3 mb-2.5 flex min-w-0 items-center gap-2 p-1">
                    <GitPullRequestArrow size={14} className="shrink-0" aria-hidden />
                    <Txt
                      as="h3"
                      id={headingId}
                      variant="ui-xs"
                      className="m-0 min-w-0 truncate"
                      title={reviewGroup.targetBranch}
                    >
                      {reviewGroup.label}
                      {reviewGroup.targetBranch ? ` · ${reviewGroup.targetBranch}` : ''}
                    </Txt>
                  </div>
                )}
                <div>{card.kind === 'work-item' ? renderWorkItem(card.value) : renderCandidate(card.value)}</div>
              </div>
            );
          }),
        )
      }
    </ColumnReveal>
  );
}
