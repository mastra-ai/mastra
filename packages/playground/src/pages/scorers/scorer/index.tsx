import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { toast } from '@mastra/playground-ui/utils/toast';
import { MoreVertical, Pencil, Play } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { ExperimentTriggerDialog } from '@/domains/datasets/components/experiment-trigger/experiment-trigger-dialog';
import { NoScoresInfo } from '@/domains/scores/components/no-scores-info';
import { ScoresColumnsMenu } from '@/domains/scores/components/scores-columns';
import { ScoresList } from '@/domains/scores/components/scores-list';
import { ScoresTools } from '@/domains/scores/components/scores-tools';
import type { ScoreEntityOption as EntityOptions } from '@/domains/scores/components/scores-tools';
import { useScorer, useScoresByScorerId } from '@/domains/scores/hooks/use-scorers';
import { useScoresColumns } from '@/domains/scores/hooks/use-scores-columns';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

export default function Scorer() {
  const { scorerId } = useParams()! as { scorerId: string };
  const [searchParams, setSearchParams] = useSearchParams();
  const scoreIdFromUrl = searchParams.get('scoreId') ?? undefined;
  const [selectedScoreId, setSelectedScoreId] = useState<string | undefined>(scoreIdFromUrl);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const navigate = useNavigate();
  const [selectedEntityOption, setSelectedEntityOption] = useState<EntityOptions | undefined>({
    value: 'all',
    label: 'All Entities',
    type: 'ALL' as const,
  });

  const { scorer, error: scorerError } = useScorer(scorerId!);
  const columnsState = useScoresColumns();

  const { data: agents = {}, isLoading: isLoadingAgents, error: agentsError } = useAgents();
  const { isLoading: isLoadingWorkflows, error: workflowsError } = useWorkflows();
  const {
    data: scores = [],
    isLoading: isLoadingScores,
    error: scoresError,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
  } = useScoresByScorerId({
    scorerId,
    entityId: selectedEntityOption?.value === 'all' ? undefined : selectedEntityOption?.value,
    entityType: selectedEntityOption?.type === 'ALL' ? undefined : selectedEntityOption?.type,
  });

  const agentOptions: EntityOptions[] = useMemo(
    () =>
      scorer?.agentIds
        ?.filter(agentId => agents[agentId])
        .map(agentId => {
          return { value: agentId, label: agents[agentId].name, type: 'AGENT' as const };
        }) || [],
    [scorer?.agentIds, agents],
  );

  const workflowOptions: EntityOptions[] = useMemo(
    () =>
      scorer?.workflowIds?.map(workflowId => {
        return { value: workflowId, label: workflowId, type: 'WORKFLOW' as const };
      }) || [],
    [scorer?.workflowIds],
  );

  const entityOptions: EntityOptions[] = useMemo(
    () => [{ value: 'all', label: 'All Entities', type: 'ALL' as const }, ...agentOptions, ...workflowOptions],
    [agentOptions, workflowOptions],
  );

  // Sync URL entity to state (treat missing ?entity as 'all' so browser back/forward resets the filter)
  const entityName = searchParams.get('entity') ?? 'all';
  const matchedEntityOption = entityOptions.find(option => option.value === entityName);
  if (matchedEntityOption && matchedEntityOption.value !== selectedEntityOption?.value) {
    setSelectedEntityOption(matchedEntityOption);
  }

  useEffect(() => {
    if (scorerError) {
      const errorMessage = scorerError instanceof Error ? scorerError.message : 'Failed to load scorer';
      toast.error(`Error loading scorer: ${errorMessage}`);
    }
  }, [scorerError]);

  useEffect(() => {
    if (agentsError) {
      const errorMessage = agentsError instanceof Error ? agentsError.message : 'Failed to load agents';
      toast.error(`Error loading agents: ${errorMessage}`);
    }
  }, [agentsError]);

  useEffect(() => {
    if (workflowsError) {
      const errorMessage = workflowsError instanceof Error ? workflowsError.message : 'Failed to load workflows';
      toast.error(`Error loading workflows: ${errorMessage}`);
    }
  }, [workflowsError]);

  const handleSelectedEntityChange = (option: EntityOptions | undefined) => {
    if (!option?.value) return;

    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('entity', option.value);
      return next;
    });
  };

  // Sync URL → state when scoreId in URL changes externally (e.g. browser back/forward)
  useEffect(() => {
    const urlScoreId = searchParams.get('scoreId') ?? undefined;

    if (urlScoreId === selectedScoreId) return;

    if (!urlScoreId) {
      setSelectedScoreId(undefined);
      return;
    }

    const matchingScore = scores.find(score => score.id === urlScoreId);
    if (!matchingScore) return;

    setSelectedScoreId(urlScoreId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, scores]);

  const handleScoreClick = useCallback(
    (id: string) => {
      setSelectedScoreId(id || undefined);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (id) {
          next.set('scoreId', id);
        } else {
          next.delete('scoreId');
        }
        return next;
      });
    },
    [setSearchParams],
  );

  if (!scorer) {
    return null;
  }

  const isUnauthorized =
    is401UnauthorizedError(scorerError) ||
    is401UnauthorizedError(agentsError) ||
    is401UnauthorizedError(workflowsError);

  const isForbidden = scorerError && is403ForbiddenError(scorerError);

  const hasOtherError = !isUnauthorized && !isForbidden && (scorerError || agentsError || workflowsError);

  const hasNoScores = !isLoadingScores && scores.length === 0;
  const hasFilterApplied = selectedEntityOption?.value !== 'all';

  const isStoredScorer = scorer?.scorer?.source === 'stored';

  const runDialog = scorerId ? (
    <ExperimentTriggerDialog
      open={runDialogOpen}
      onOpenChange={setRunDialogOpen}
      initialScorerIds={[scorerId]}
      onSuccess={experimentId => void navigate(`/experiments/${experimentId}`)}
    />
  ) : null;

  const scorerActionsMenu = isStoredScorer ? (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button size="lg" aria-label="Scorer actions menu">
          <MoreVertical />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="w-48">
        <DropdownMenu.Item onSelect={() => void navigate(`/cms/scorers/${scorerId}/edit`)}>
          <Pencil /> Edit Scorer
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  ) : null;

  const showEmptyState = isUnauthorized || isForbidden || hasOtherError || (hasNoScores && !hasFilterApplied);

  if (showEmptyState) {
    const errorMessage =
      (scorerError instanceof Error ? scorerError.message : undefined) ??
      (agentsError instanceof Error ? agentsError.message : undefined) ??
      (workflowsError instanceof Error ? workflowsError.message : undefined) ??
      'An unexpected error occurred';
    const hasError = isUnauthorized || isForbidden || hasOtherError;

    return (
      <PageLayout width="wide" height="full" className={hasError || !scorerActionsMenu ? 'grid-rows-[1fr]' : undefined}>
        {!hasError && scorerActionsMenu && (
          <PageLayout.TopArea>
            <ButtonsGroup className="ml-auto">{scorerActionsMenu}</ButtonsGroup>
          </PageLayout.TopArea>
        )}
        <PageLayout.MainArea isCentered>
          {isUnauthorized ? (
            <SessionExpired />
          ) : isForbidden ? (
            <PermissionDenied resource="scorers" />
          ) : hasOtherError ? (
            <ErrorState title="Failed to load scorer" message={errorMessage} />
          ) : (
            <NoScoresInfo onRunExperiment={() => setRunDialogOpen(true)} />
          )}
        </PageLayout.MainArea>
        {runDialog}
      </PageLayout>
    );
  }

  return (
    <PageLayout width="wide" height="full">
      <PageLayout.TopArea>
        <div className="flex items-center justify-between gap-3">
          <ScoresTools
            selectedEntity={selectedEntityOption}
            entityOptions={entityOptions}
            onEntityChange={handleSelectedEntityChange}
            onReset={() => {
              setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.set('entity', 'all');
                return next;
              });
            }}
            isLoading={isLoadingScores || isLoadingAgents || isLoadingWorkflows}
          />
          <ButtonsGroup>
            <ScoresColumnsMenu visibleColumns={columnsState.visibleColumns} toggleColumn={columnsState.toggleColumn} />
            <Button variant="primary" onClick={() => setRunDialogOpen(true)}>
              <Play />
              Run Experiment
            </Button>
            {scorerActionsMenu}
          </ButtonsGroup>
        </div>
      </PageLayout.TopArea>

      <ScoresList
        scores={scores}
        isLoading={isLoadingScores}
        selectedScoreId={selectedScoreId}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        setEndOfListElement={setEndOfListElement}
        onScoreClick={handleScoreClick}
        errorMsg={scoresError?.message}
        columnsState={columnsState}
      />
      {runDialog}
    </PageLayout>
  );
}
