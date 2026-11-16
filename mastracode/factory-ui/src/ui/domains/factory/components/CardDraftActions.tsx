import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { toast } from '@mastra/playground-ui/components/Toaster';

import type { InstalledBoardInfo } from '../../../../api/types';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useRunQueue } from '../../../../hooks/useFactoryDecisions';
import type { FactoryProject, LinkedRepositoryPayload } from '../../workspaces/services/github';
import { cardSourceMetadata } from '../boardRepository';
import { currentItemStage } from '../boardStages';
import { cardControls } from '../cardControls';
import { useBoardDecisions } from '../hooks/useBoardDecisions';
import { useBoardItems } from '../hooks/useBoardItems';
import { useRepositoryChoice } from '../hooks/useRepositoryChoice';
import type { WorkItem } from '../services/workItems';
import { RepositoryPickerDialog } from './RepositoryPickerDialog';

export function CardDraftActions({
  factory,
  item,
  board,
  chosenRepository,
}: {
  factory: FactoryProject;
  item: WorkItem;
  board: InstalledBoardInfo;
  chosenRepository: LinkedRepositoryPayload | undefined;
}) {
  const currentUserId = useFactoryAuth().data?.user?.userId;
  const decisions = useBoardDecisions(factory.id);
  const queuePosition = useRunQueue(factory.id).data?.queued.find(run => run.workItem?.id === item.id)?.position;
  const items = useBoardItems({
    factoryProjectId: factory.id,
    kind: board.id,
    items: [item],
    currentUserId,
    onFailure: message => toast.error(message),
  });
  const repositoryChoice = useRepositoryChoice(factory, board);
  const move = (stage: string) => {
    if (chosenRepository) {
      items.move(item.id, stage, { repositorySlug: chosenRepository.slug });
      return;
    }
    void repositoryChoice.choose(
      item.source,
      cardSourceMetadata(item),
      stage,
      slug => items.move(item.id, stage, { repositorySlug: slug }),
      () => items.move(item.id, stage),
    );
  };
  const { actions } = cardControls({
    item,
    definition: board,
    columnStage: currentItemStage(item, board) ?? board.initialPhase,
    evaluatingStage: items.evaluatingStages.get(item.id),
    transitionReason: items.transitionReasons[item.id],
    decision: decisions.effectByItem.get(item.id),
    queuePosition,
    proposal: decisions.proposalByItem.get(item.id),
    approvingDecisionId: decisions.approvingId,
    retryingDecisionId: decisions.retryingId,
    onApproveProposal: decisions.approve,
    onRetryDecision: decisions.retry,
    onMove: move,
  });

  return (
    <>
      {decisions.error && <Notice variant="destructive">{decisions.error.message}</Notice>}
      {actions.length > 0 && (
        <div role="group" aria-label="Suggested actions" className="flex flex-wrap justify-center gap-2">
          {actions.map((action, index) => (
            <Button
              key={action.label}
              type="button"
              size="md"
              variant={index === 0 && !action.disabled ? 'primary' : 'default'}
              aria-label={action.ariaLabel}
              disabled={action.disabled}
              onClick={() => action.start()}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
      {repositoryChoice.pending && (
        <RepositoryPickerDialog
          repositories={factory.repositories}
          onClose={repositoryChoice.cancel}
          onSelect={repository => repositoryChoice.select(repository.slug)}
        />
      )}
    </>
  );
}
