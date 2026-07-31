import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Plus } from 'lucide-react';
import { Link } from 'react-router';

import { INTAKE_SOURCES, stageContentCount } from '../domains/factory/boardCandidates';
import type { IntakeSource } from '../domains/factory/boardCandidates';
import { boardLoadingStages, boardStages, itemAppearsInStage } from '../domains/factory/boardStages';
import type { BoardKind } from '../domains/factory/boardStages';
import { BoardColumn } from '../domains/factory/components/BoardColumn';
import { BoardColumnEmptyState } from '../domains/factory/components/BoardColumnEmptyState';
import { CandidateCard } from '../domains/factory/components/CandidateCard';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { InlineWorkItemComposer } from '../domains/factory/components/InlineWorkItemComposer';
import { IntakeColumnExtras } from '../domains/factory/components/IntakeColumnExtras';
import { WorkItemCard } from '../domains/factory/components/WorkItemCard';
import { useBoardComposer } from '../domains/factory/hooks/useBoardComposer';
import { useBoardDecisions } from '../domains/factory/hooks/useBoardDecisions';
import { useBoardIntake } from '../domains/factory/hooks/useBoardIntake';
import { useBoardItems } from '../domains/factory/hooks/useBoardItems';
import { useBoardRuns } from '../domains/factory/hooks/useBoardRuns';
import { useBoardScroll } from '../domains/factory/hooks/useBoardScroll';
import type { FactoryProject, LinkedRepositoryPayload } from '../domains/workspaces/services/github';
import { SkeletonRows } from '../ui/SkeletonRows';
import { GithubIcon } from '../ui/icons';
import { settingsSectionPath } from '../domains/settings/settingsSections';

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
              ? 'Link a GitHub repository in Repository settings. Its pull requests will appear in Intake, ready to move through review.'
              : 'Link a GitHub repository in Repository settings. Its issues will appear in Intake, ready to move through planning and build.'
          }
          actionSlot={
            <Link
              to={settingsSectionPath(factory.id, 'repositories')}
              className={buttonVariants({ variant: 'primary' })}
            >
              Open Repository settings
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
  const factoryProjectId = factory.id;
  const review = kind === 'review';
  const stages = boardStages(kind);

  const items = useBoardItems({ factoryProjectId, kind });
  const intake = useBoardIntake({ factoryProjectId, repository, kind, knownSourceKeys: items.knownSourceKeys });
  const runs = useBoardRuns({
    factoryProjectId,
    projectRepositoryId: repository.projectRepositoryId,
    workItems: items.all,
    refetchItems: items.refetch,
  });
  const decisions = useBoardDecisions(factoryProjectId);
  const composer = useBoardComposer(factoryProjectId);
  const loadingStages = boardLoadingStages({
    stages,
    itemsPending: items.isPending,
    intakePending: intake.isPending,
    triagePending: intake.isTriagePending,
  });
  const scroll = useBoardScroll({
    boardKey: `${factoryProjectId}:${kind}`,
    settled: loadingStages.size === 0,
    stages,
    workItems: items.visible,
    candidates: intake.candidates,
  });

  if (items.error !== undefined) {
    return (
      <Notice variant="destructive">
        {items.error instanceof Error ? items.error.message : 'Failed to load the board'}
      </Notice>
    );
  }

  const mutationError = runs.error ?? items.mutationError;
  const totalTaskCount = items.visible.length + intake.candidates.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {mutationError !== undefined && (
        <Notice variant="destructive">
          {mutationError instanceof Error ? mutationError.message : 'Board action failed'}
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
            const loading = loadingStages.has(stage.id);
            const taskCount = stageContentCount(stage.id, stages, items.visible, intake.candidates);
            const composerOpen = composer.stage === stage.id;
            return (
              <BoardColumn
                key={stage.id}
                stage={stage.id}
                label={stage.label}
                taskCount={taskCount}
                totalTaskCount={totalTaskCount}
                loading={loading}
                composerOpen={composerOpen}
                laneRef={scroll.registerLane(stage.id)}
                onDrop={items.handleDrop}
                headerAction={
                  !review &&
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
                  stage.id === 'intake' && intake.showSwitch ? (
                    <IntakeSourceSwitch available={intake.available} active={intake.active} onSelect={intake.select} />
                  ) : undefined
                }
              >
                {composerOpen ? (
                  <InlineWorkItemComposer
                    stage={stage.id}
                    stageLabel={stage.label}
                    onCreate={title => composer.submit(stage.id, title)}
                    onClose={() => composer.close(stage.id)}
                  />
                ) : null}
                {items.visible
                  .filter(item => itemAppearsInStage(item, stage.id, stages))
                  .map(item => (
                    <WorkItemCard
                      key={`${item.id}:${stage.id}`}
                      item={item}
                      columnStage={stage.id}
                      allItems={items.all}
                      liveWorktreePaths={runs.liveWorktreePaths}
                      runDisabled={runs.disabled}
                      preparing={runs.preparingFor(item.id)}
                      evaluatingStage={items.evaluatingStages.get(item.id)}
                      transitionReason={items.transitionReasons[item.id]}
                      decision={decisions.byItem.get(item.id)}
                      retryingDecisionId={decisions.retryingId}
                      onRetryDecision={decisions.retry}
                      pendingRunRoles={runs.pendingRolesFor(item.id)}
                      onCreateSession={() => void runs.openOrCreateSession(item, stage.id)}
                      onStartRun={(_spec, action) => void runs.openOrStartRun(item, action.role)}
                      onMove={toStage => items.move(item.id, toStage)}
                      onRemove={() => items.remove(item.id)}
                    />
                  ))}
                {intake.candidates
                  .filter(candidate => candidate.column === stage.id)
                  .map(candidate => {
                    const issue = candidate.issue;
                    return (
                      <CandidateCard
                        key={candidate.sourceKey}
                        candidate={candidate}
                        pendingRunRoles={runs.pendingRolesForSource(candidate.sourceKey)}
                        triageStarting={issue !== undefined && runs.triagingIssueNumbers.has(issue.number)}
                        disabled={!runs.enabled}
                        onRun={(action, prompt) => runs.startCandidateRun(candidate, action, prompt)}
                        onFile={() => items.handleDrop({ kind: 'candidate', candidate }, candidate.column)}
                        onTriage={issue ? () => runs.triageCandidate(issue) : undefined}
                      />
                    );
                  })}
                {loading && (
                  <SkeletonRows label={`Loading ${stage.label} column`} rows={3} rowClassName="h-24 w-full" />
                )}
                {!loading && !composerOpen && taskCount === 0 && (
                  <BoardColumnEmptyState stage={stage.id} kind={kind} hasIntakeSource={intake.active !== undefined} />
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

function IntakeSourceSwitch({
  available,
  active,
  onSelect,
}: {
  available: readonly IntakeSource[];
  active?: IntakeSource;
  onSelect: (source: IntakeSource) => void;
}) {
  return (
    <div role="group" aria-label="Intake source" className="flex items-center gap-1 pb-1">
      {INTAKE_SOURCES.filter(source => available.includes(source.id)).map(source => (
        <button
          key={source.id}
          type="button"
          aria-pressed={active === source.id}
          onClick={() => onSelect(source.id)}
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-ui-xs transition',
            active === source.id
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
