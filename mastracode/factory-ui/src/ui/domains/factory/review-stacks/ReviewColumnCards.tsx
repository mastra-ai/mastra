import { Txt } from '@mastra/playground-ui/components/Txt';
import { GitPullRequestArrow } from 'lucide-react';
import { Fragment } from 'react';
import type { ReactNode } from 'react';

import type { BoardCandidate } from '../boardCandidates';
import { ColumnReveal } from '../components/ColumnReveal';
import type { WorkItem } from '../services/workItems';
import { groupReviewCards, reviewCardKey, reviewCards } from './reviewStacks';
import type { ReviewCard } from './reviewStacks';

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
  const cards = groupReviewCards(reviewCards(workItems, candidates)).flatMap(group => group.cards);
  const renderCard = (card: ReviewCard) => (
    <Fragment key={reviewCardKey(card)}>
      {card.kind === 'work-item' ? renderWorkItem(card.value) : renderCandidate(card.value)}
    </Fragment>
  );
  return (
    <ColumnReveal items={cards} pinned={card => card.kind === 'work-item' && card.value.id === targetItemId}>
      {visibleCards =>
        groupReviewCards(visibleCards).map(({ stack, cards }) => {
          if (!stack) return renderCard(cards[0]);
          return (
            <div
              key={stack.id}
              role="group"
              aria-label={`Stack #${stack.number} · ${stack.base.ref}`}
              data-review-stack={stack.id}
              className="before:border-neutral3/30 relative flex min-w-0 flex-col gap-2.5 before:pointer-events-none before:absolute before:-inset-0.5 before:rounded-t-[12px] before:rounded-b-[calc(var(--radius-card)+var(--spacing-0\_5))] before:border before:border-dashed"
            >
              <div className="text-icon3 flex min-w-0 items-center gap-2 p-1">
                <GitPullRequestArrow size={14} className="shrink-0" aria-hidden />
                <Txt as="h3" variant="ui-xs" className="m-0 min-w-0 truncate" title={stack.base.ref}>
                  Stack #{stack.number} · {stack.base.ref}
                </Txt>
              </div>
              {cards.map(renderCard)}
            </div>
          );
        })
      }
    </ColumnReveal>
  );
}
