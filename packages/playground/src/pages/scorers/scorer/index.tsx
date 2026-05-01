import {
  Breadcrumb,
  Button,
  ButtonWithTooltip,
  Crumb,
  ErrorState,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
  toast,
} from '@mastra/playground-ui';
import { BookIcon, GaugeIcon, PencilIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { NoScoresInfo } from '@/domains/scores/components/no-scores-info';
import { ScorerCombobox } from '@/domains/scores/components/scorer-combobox';
import { ScoresList } from '@/domains/scores/components/scores-list';
import { ScoresTools } from '@/domains/scores/components/scores-tools';
import type { ScoreEntityOption as EntityOptions } from '@/domains/scores/components/scores-tools';
import { useScorer, useScoresByScorerId } from '@/domains/scores/hooks/use-scorers';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

export default function Scorer() {
  const { scorerId } = useParams()! as { scorerId: string };
  const [searchParams, setSearchParams] = useSearchParams();
  const scoreIdFromUrl = searchParams.get('scoreId') ?? undefined;
  const [selectedScoreId, setSelectedScoreId] = useState<string | undefined>(scoreIdFromUrl);
  const [selectedEntityOption, setSelectedEntityOption] = useState<EntityOptions | undefined>({
    value: 'all',
    label: 'All Entities',
    type: 'ALL' as const,
  });

  const { scorer, isLoading: isScorerLoading, error: scorerError } = useScorer(scorerId!);

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

  const scorerTopAreaSharedContent = (
    <>
      <Breadcrumb>
        <Crumb as={Link} to={`/scorers`}>
          Scorers
        </Crumb>
        <ScorerCombobox value={scorerId} variant="link" />
      </Breadcrumb>
      <PageLayout.Row>
        <PageHeader>
          <PageHeader.Title isLoading={isScorerLoading}>
            <GaugeIcon /> {scorer?.scorer?.config?.name || scorerId}
          </PageHeader.Title>
          {(isScorerLoading || scorer?.scorer?.config?.description) && (
            <PageHeader.Description isLoading={isScorerLoading}>
              {scorer?.scorer?.config?.description}
            </PageHeader.Description>
          )}
        </PageHeader>
        <div className="flex justify-end gap-2">
          <ButtonWithTooltip
            as="a"
            href="https://mastra.ai/en/docs/evals/overview"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Scorers documentation"
            tooltipContent="Go to Scorers documentation"
          >
            <BookIcon />
          </ButtonWithTooltip>
          {scorer?.scorer?.source === 'stored' && (
            <Button variant="default" as={Link} to={`/cms/scorers/${scorerId}/edit`}>
              <PencilIcon /> Edit
            </Button>
          )}
        </div>
      </PageLayout.Row>
    </>
  );

  const showEmptyState = isUnauthorized || isForbidden || hasOtherError || (hasNoScores && !hasFilterApplied);

  if (showEmptyState) {
    const errorMessage =
      (scorerError instanceof Error ? scorerError.message : undefined) ??
      (agentsError instanceof Error ? agentsError.message : undefined) ??
      (workflowsError instanceof Error ? workflowsError.message : undefined) ??
      'An unexpected error occurred';

    return (
      <PageLayout width="wide" height="full">
        <PageLayout.TopArea>{scorerTopAreaSharedContent}</PageLayout.TopArea>
        <PageLayout.MainArea isCentered>
          {isUnauthorized ? (
            <SessionExpired />
          ) : isForbidden ? (
            <PermissionDenied resource="scorers" />
          ) : hasOtherError ? (
            <ErrorState title="Failed to load scorer" message={errorMessage} />
          ) : (
            <NoScoresInfo />
          )}
        </PageLayout.MainArea>
      </PageLayout>
    );
  }

  return (
    <PageLayout width="wide">
      <PageLayout.TopArea>
        {scorerTopAreaSharedContent}
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
      />
    </PageLayout>
  );
}
