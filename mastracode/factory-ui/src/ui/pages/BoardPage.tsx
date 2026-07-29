import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Plus } from 'lucide-react';
import { Link } from 'react-router';

import { INTAKE_SOURCES, stageContentCount } from '../domains/factory/boardCandidates';
import { itemAppearsInStage } from '../domains/factory/boardStages';
import type { BoardKind } from '../domains/factory/boardStages';
import { BoardColumn } from '../domains/factory/components/BoardColumn';
import { BoardColumnEmptyState } from '../domains/factory/components/BoardColumnEmptyState';
import { CandidateCard } from '../domains/factory/components/CandidateCard';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { InlineWorkItemComposer } from '../domains/factory/components/InlineWorkItemComposer';
import { IntakeColumnExtras } from '../domains/factory/components/IntakeColumnExtras';
import { WorkItemCard } from '../domains/factory/components/WorkItemCard';
import { useBoardState } from '../domains/factory/hooks/useBoardState';
import type { FactoryProject, LinkedRepositoryPayload } from '../domains/workspaces/services/github';
import { SkeletonRows } from '../ui/SkeletonRows';
import { GithubIcon } from '../ui/icons';

/**
 * Factory › Board: an org-wide kanban over the repository's work items. The
 * Intake column merges persisted `intake` cards with live GitHub/Linear
 * candidates (issues and PRs that have no record yet — records are
 * materialized only when someone acts on them). Everything enters through
 * Intake and moves through the system from there. Cards move between columns
 * by drag-and-drop or the card menu; moves only file/move cards, never start
 * agent runs.
 */
export function WorkBoardPage() {
  return <FactoryPageShell>{factory => <Board factory={factory} kind="work" />}</FactoryPageShell>;
}

export function ReviewBoardPage() {
  return <FactoryPageShell>{factory => <Board factory={factory} kind="review" />}</FactoryPageShell>;
}

function Board({ factory, kind }: { factory: FactoryProject; kind: BoardKind }) {
  const repository = factory.repositories[0];
  const review = kind === 'review';

  if (!repository) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-8">
        <EmptyState
          as="h2"
          iconSlot={<GithubIcon size={40} className="text-icon3" />}
          titleSlot={review ? 'Connect a repository to start reviewing' : 'Connect a repository to start intake'}
          descriptionSlot={
            review
              ? 'Link a GitHub repository in Source Control settings. Its pull requests will appear in Intake, ready to move through review.'
              : 'Link a GitHub repository in Source Control settings. Its issues will appear in Intake, ready to move through planning and build.'
          }
          actionSlot={
            <Link
              to={`/factories/${factory.id}/settings/source-control`}
              className={buttonVariants({ variant: 'primary' })}
            >
              Open Source Control settings
            </Link>
          }
        />
      </div>
    );
  }

  return <BoardContent factory={factory} repository={repository} kind={kind} />;
}

function BoardContent({
  factory,
  repository,
  kind,
}: {
  factory: FactoryProject;
  repository: LinkedRepositoryPayload;
  kind: BoardKind;
}) {
  const board = useBoardState({ factory, repository, kind });
  const { composer, intake, scroll, stages } = board;

  if (board.itemsError !== undefined) {
    return (
      <Notice variant="destructive">
        {board.itemsError instanceof Error ? board.itemsError.message : 'Failed to load the board'}
      </Notice>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {board.mutationError !== undefined && (
        <Notice variant="destructive">
          {board.mutationError instanceof Error ? board.mutationError.message : 'Board action failed'}
        </Notice>
      )}
      <ScrollArea
        viewportRef={scroll.containerRef}
        orientation="horizontal"
        className="min-h-0 flex-1 [&_[data-hovering]:not([data-scrolling])]:opacity-0"
        viewPortClassName="pb-2 *:h-full"
        aria-label="Board columns"
        onPointerDown={scroll.claimForUser}
        onWheel={scroll.claimForUser}
      >
        <div className="flex h-full min-h-0 gap-3">
          {stages.map(stage => {
            const loading = board.loadingStages.has(stage.id);
            const taskCount = stageContentCount(stage.id, stages, board.workItems, board.candidates);
            const composerOpen = composer.stage === stage.id;
            return (
              <BoardColumn
                key={stage.id}
                stage={stage.id}
                label={stage.label}
                taskCount={taskCount}
                totalTaskCount={board.totalTaskCount}
                loading={loading}
                composerOpen={composerOpen}
                laneRef={scroll.registerLane(stage.id)}
                onDrop={board.handleDrop}
                headerAction={
                  !board.review &&
                  !loading &&
                  stage.id !== 'done' &&
                  stage.id !== 'canceled' &&
                  (composer.stage === undefined || composerOpen) ? (
                    <Button
                      ref={composer.registerTrigger(stage.id)}
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Create work item in ${stage.label}`}
                      title={`Create work item in ${stage.label}`}
                      aria-expanded={composerOpen}
                      aria-controls={`new-work-item-${stage.id}`}
                      onClick={() => composer.open(stage.id)}
                    >
                      <Plus size={13} aria-hidden />
                    </Button>
                  ) : undefined
                }
                headerExtras={
                  stage.id === 'intake' && intake.showSwitch ? <IntakeSourceSwitch intake={intake} /> : undefined
                }
              >
                {composerOpen ? (
                  <InlineWorkItemComposer
                    stage={stage.id}
                    stageLabel={stage.label}
                    onCreate={title => composer.create(stage.id, title)}
                    onClose={() => composer.close(stage.id)}
                  />
                ) : null}
                {board.workItems
                  .filter(item => itemAppearsInStage(item, stage.id, stages))
                  .map(item => (
                    <WorkItemCard
                      key={`${item.id}:${stage.id}`}
                      item={item}
                      columnStage={stage.id}
                      allItems={board.allWorkItems}
                      liveWorktreePaths={board.liveWorktreePaths}
                      runDisabled={board.runDisabled}
                      evaluatingStage={board.evaluatingStages.get(item.id)}
                      transitionReason={board.transitionReasons[item.id]}
                      decision={board.decisionByItem.get(item.id)}
                      retryingDecisionId={board.retryDecision.isPending ? board.retryDecision.variables : undefined}
                      onRetryDecision={decisionId => board.retryDecision.mutate(decisionId)}
                      pendingRunRoles={board.pendingRunRolesFor(item.id)}
                      onCreateSession={() => void board.openOrCreateSession(item, stage.id)}
                      onStartRun={(_spec, action) => void board.openOrStartRun(item, action.role)}
                      onMove={toStage => board.moveItem(item.id, toStage)}
                      onRemove={() => board.removeItem(item.id)}
                    />
                  ))}
                {board.candidates
                  .filter(candidate => candidate.column === stage.id)
                  .map(candidate => {
                    const issue = candidate.issue;
                    return (
                      <CandidateCard
                        key={candidate.sourceKey}
                        candidate={candidate}
                        pendingRunRoles={board.pendingRunRolesForSource(candidate.sourceKey)}
                        triageStarting={issue !== undefined && board.triagingIssueNumbers.has(issue.number)}
                        disabled={!board.runEnabled}
                        onRun={(action, prompt) => board.startCandidateRun(candidate, action, prompt)}
                        onFile={() => board.fileCandidate(candidate)}
                        onTriage={issue ? () => board.triageCandidate(issue) : undefined}
                      />
                    );
                  })}
                {loading && (
                  <SkeletonRows label={`Loading ${stage.label} column`} rows={3} rowClassName="h-24 w-full" />
                )}
                {!loading && !composerOpen && taskCount === 0 && (
                  <BoardColumnEmptyState stage={stage.id} kind={kind} hasIntakeSource={intake.active !== null} />
                )}
                {stage.id === 'intake' && (
                  <IntakeColumnExtras
                    source={intake.active}
                    issues={intake.issues}
                    pulls={intake.pulls}
                    linearIssues={intake.linearIssues}
                  />
                )}
              </BoardColumn>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function IntakeSourceSwitch({ intake }: { intake: ReturnType<typeof useBoardState>['intake'] }) {
  return (
    <div role="group" aria-label="Intake source" className="flex items-center gap-1 pb-1">
      {INTAKE_SOURCES.filter(source => intake.available.includes(source.id)).map(source => (
        <button
          key={source.id}
          type="button"
          aria-pressed={intake.active === source.id}
          onClick={() => intake.select(source.id)}
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-ui-xs transition',
            intake.active === source.id
              ? 'border-accent1 bg-surface4 text-icon6'
              : 'border-border1 bg-transparent text-icon3 hover:text-icon5',
          )}
        >
          {source.label}
        </button>
      ))}
    </div>
  );
}
