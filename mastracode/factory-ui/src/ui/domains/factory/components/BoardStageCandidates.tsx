import { Txt } from '@mastra/playground-ui/components/Txt';
import type { BoardCandidate } from '../boardCandidates';
import type { BoardLayout } from '../boardLayout';
import type { CardMove } from '../cardPrimaryAction';
import { CandidateCard } from './CandidateCard';
import { ColumnReveal } from './ColumnReveal';

export function BoardStageCandidates({
  candidates,
  afterWorkItems,
  layout,
  projectRepositoryId,
  factoryProjectId,
  onRun,
}: {
  candidates: BoardCandidate[];
  afterWorkItems: boolean;
  layout: BoardLayout;
  projectRepositoryId: string;
  factoryProjectId: string;
  onRun: (candidate: BoardCandidate, move: CardMove, prompt?: string) => void;
}) {
  const showDivider = afterWorkItems && candidates.length > 0;
  return (
    <>
      {showDivider && (
        <div role="separator" aria-label="New candidates" className="flex items-center gap-2 py-1">
          <span aria-hidden className="bg-border h-px flex-1" />
          <Txt as="span" variant="meta" tone="muted">
            New candidates
          </Txt>
          <span aria-hidden className="bg-border h-px flex-1" />
        </div>
      )}
      <ColumnReveal
        items={candidates}
        renderItem={candidate => (
          <CandidateCard
            key={candidate.sourceKey}
            layout={layout}
            candidate={candidate}
            projectRepositoryId={projectRepositoryId}
            factoryProjectId={factoryProjectId}
            onRun={(move, prompt) => onRun(candidate, move, prompt)}
          />
        )}
      />
    </>
  );
}
