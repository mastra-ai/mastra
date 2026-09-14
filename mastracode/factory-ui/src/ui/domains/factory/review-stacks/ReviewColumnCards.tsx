import { Txt } from '@mastra/playground-ui/components/Txt';
import { GitPullRequestArrow } from 'lucide-react';
import { Fragment } from 'react';
import type { ReactNode } from 'react';

import type { BoardCandidate } from '../boardCandidates';
import { ColumnReveal } from '../components/ColumnReveal';
import type { WorkItem } from '../services/workItems';
import { groupReviewCards, reviewCardKey, reviewCards } from './reviewStacks';
import type { ReviewCard, ReviewStackMember } from './reviewStacks';

export function ReviewColumnCards({
  workItems,
  candidates,
  stacks,
  targetItemId,
  renderWorkItem,
  renderCandidate,
}: {
  workItems: readonly WorkItem[];
  candidates: readonly BoardCandidate[];
  stacks: ReadonlyMap<string, ReviewStackMember>;
  targetItemId?: string;
  renderWorkItem: (item: WorkItem) => ReactNode;
  renderCandidate: (candidate: BoardCandidate) => ReactNode;
}) {
  const cards = groupReviewCards(reviewCards(workItems, candidates), stacks).flat();
  const renderCard = (card: ReviewCard) => (
    <Fragment key={reviewCardKey(card)}>
      {card.kind === 'work-item' ? renderWorkItem(card.value) : renderCandidate(card.value)}
    </Fragment>
  );
  return (
    <ColumnReveal items={cards} pinned={card => card.kind === 'work-item' && card.value.id === targetItemId}>
      {visibleCards =>
        groupReviewCards(visibleCards, stacks).map(group => {
          const stack = stacks.get(reviewCardKey(group[0]))?.stack;
          if (!stack) return renderCard(group[0]);
          return (
            <div
              key={stack.id}
              role="group"
              aria-label={`Stack #${stack.number} · ${stack.title}`}
              data-review-stack={stack.id}
              className="before:rounded-card before:border-neutral3/30 relative flex min-w-0 flex-col gap-2.5 before:pointer-events-none before:absolute before:-inset-1 before:border before:border-dashed"
            >
              <div className="text-icon3 flex min-w-0 items-center gap-2 p-1">
                <GitPullRequestArrow size={14} className="shrink-0" aria-hidden />
                <Txt as="h3" variant="ui-xs" className="m-0 min-w-0 truncate" title={stack.title}>
                  Stack #{stack.number} · {stack.title}
                </Txt>
              </div>
              {group.map(renderCard)}
            </div>
          );
        })
      }
    </ColumnReveal>
  );
}
