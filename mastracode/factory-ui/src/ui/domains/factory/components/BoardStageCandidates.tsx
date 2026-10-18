import { Txt } from '@mastra/playground-ui/components/Txt';
import type { BoardCandidate } from '../boardCandidates';
import type { BoardLayout } from '../boardLayout';
import type { CardMove } from '../cardPrimaryAction';
import { CandidateCard } from './CandidateCard';
import { VirtualBoardItems } from './VirtualBoardItems';

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
  /** The linked repository each candidate comes from. */
  projectRepositoryId: (candidate: BoardCandidate) => string;
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
      <VirtualBoardItems
        items={candidates}
        itemKey={candidate => candidate.sourceKey}
        layout={layout}
        renderItem={candidate => (
          <CandidateCard
            layout={layout}
            candidate={candidate}
            projectRepositoryId={projectRepositoryId(candidate)}
            factoryProjectId={factoryProjectId}
            onRun={(move, prompt) => onRun(candidate, move, prompt)}
          />
        )}
      />
    </>
  );
}
