import type { ClientScoreRowData } from '@mastra/client-js';
import type { ScoreRowData } from '@mastra/core/evals';
import {
  Breadcrumb,
  Button,
  Crumb,
  DocsIcon,
  Header,
  HeaderAction,
  Icon,
  KeyValueList,
  MainContentLayout,
  PageHeader,
  PermissionDenied,
  SessionExpired,
  Spinner,
  getToNextEntryFn,
  getToPreviousEntryFn,
  is401UnauthorizedError,
  is403ForbiddenError,
  toast,
} from '@mastra/playground-ui';
import { GaugeIcon, PencilIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useScorer, useScoresByScorerId } from '@/domains/scores';
import { ScoreDialog } from '@/domains/scores/components/score-dialog';
import { ScorerCombobox } from '@/domains/scores/components/scorer-combobox';
import { ScoresList } from '@/domains/scores/components/scores-list';
import { ScoresTools } from '@/domains/scores/components/scores-tools';
import type { ScoreEntityOption as EntityOptions } from '@/domains/scores/components/scores-tools';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { cn } from '@/lib/utils';

export default function Scorer() {
  const { scorerId } = useParams()! as { scorerId: string };
  const [searchParams, setSearchParams] = useSearchParams();
  const scoreIdFromUrl = searchParams.get('scoreId') ?? undefined;
  const [selectedScoreId, setSelectedScoreId] = useState<string | undefined>(scoreIdFromUrl);
  const [scoresPage, setScoresPage] = useState<number>(0);
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(!!scoreIdFromUrl);

  const [selectedEntityOption, setSelectedEntityOption] = useState<EntityOptions | undefined>({
    value: 'all',
    label: 'All Entities',
    type: 'ALL' as const,
  });

  const { scorer, isLoading: isScorerLoading, error: scorerError } = useScorer(scorerId!);
  const { data: agents = {}, isLoading: isLoadingAgents, error: agentsError } = useAgents();
  const { data: workflows, isLoading: isLoadingWorkflows, error: workflowsError } = useWorkflows();
  const {
    data: scoresData,
    isLoading: isLoadingScores,
    error: scoresError,
  } = useScoresByScorerId({
    scorerId,
    page: scoresPage,
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

  // Sync URL entity to state
  const entityName = searchParams.get('entity');
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

  const scores = useMemo(() => scoresData?.scores || [], [scoresData?.scores]);
  const pagination = scoresData?.pagination;

  const scorerAgents =
    scorer?.agentIds?.map(agentId => {
      return {
        name: agentId,
        id: Object.entries(agents).find(([, value]) => value.name === agentId)?.[0],
      };
    }) || [];

  const scorerWorkflows =
    scorer?.workflowIds?.map(workflowId => {
      return {
        name: workflowId,
        id: Object.entries(workflows || {}).find(([, value]) => value.name === workflowId)?.[0],
      };
    }) || [];

  const scorerEntities = [
    ...scorerAgents.map(agent => ({ id: agent.id, name: agent.name, type: 'AGENT' })),
    ...scorerWorkflows.map(workflow => ({ id: workflow.id, name: workflow.name, type: 'WORKFLOW' })),
  ];

  const scoreInfo = [
    {
      key: 'entities',
      label: 'Entities',
      value: (scorerEntities || []).map(entity => ({
        id: entity.id,
        name: entity.name || entity.id,
        path: `${entity.type === 'AGENT' ? '/agents' : '/workflows'}/${entity.name}`,
      })),
    },
  ];

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
      setDialogIsOpen(false);
      return;
    }

    const matchingScore = scores.find(score => score.id === urlScoreId);
    if (!matchingScore) return;

    setSelectedScoreId(urlScoreId);
    setDialogIsOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, scores]);

  if (
    is401UnauthorizedError(scorerError) ||
    is401UnauthorizedError(agentsError) ||
    is401UnauthorizedError(workflowsError)
  ) {
    return (
      <MainContentLayout>
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to={`/scorers`}>
              <Icon>
                <GaugeIcon />
              </Icon>
              Scorers
            </Crumb>
            <Crumb as="span" to="" isCurrent>
              {scorerId}
            </Crumb>
          </Breadcrumb>
        </Header>

        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </MainContentLayout>
    );
  }

  if (scorerError && is403ForbiddenError(scorerError)) {
    return (
      <MainContentLayout>
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to={`/scorers`}>
              <Icon>
                <GaugeIcon />
              </Icon>
              Scorers
            </Crumb>
            <Crumb as="span" to="" isCurrent>
              {scorerId}
            </Crumb>
          </Breadcrumb>
        </Header>

        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="scorers" />
        </div>
      </MainContentLayout>
    );
  }

  if (isScorerLoading || scorerError || agentsError || workflowsError) return null;

  const handleScoreClick = (id: string) => {
    setSelectedScoreId(id);
    setDialogIsOpen(true);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('scoreId', id);
      return next;
    });
  };

  const updateSelectedScoreId = (id: string | undefined) => {
    setSelectedScoreId(id);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (id) {
        next.set('scoreId', id);
      } else {
        next.delete('scoreId');
      }
      return next;
    });
  };

  const toNextScore = getToNextEntryFn({ entries: scores, id: selectedScoreId, update: updateSelectedScoreId });
  const toPreviousScore = getToPreviousEntryFn({ entries: scores, id: selectedScoreId, update: updateSelectedScoreId });

  return (
    <>
      <MainContentLayout>
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to={`/scorers`}>
              <Icon>
                <GaugeIcon />
              </Icon>
              Scorers
            </Crumb>
            <Crumb as="span" to="" isCurrent>
              <ScorerCombobox value={scorerId} variant="ghost" />
            </Crumb>
          </Breadcrumb>

          <HeaderAction>
            {scorer?.scorer?.source === 'stored' && (
              <Button variant="light" as={Link} to={`/cms/scorers/${scorerId}/edit`}>
                <Icon>
                  <PencilIcon />
                </Icon>
                Edit
              </Button>
            )}
            <Button as={Link} to="https://mastra.ai/en/docs/evals/overview" target="_blank" variant="ghost" size="md">
              <DocsIcon />
              Scorers documentation
            </Button>
          </HeaderAction>
        </Header>

        <div className={cn(`grid overflow-y-auto h-full`)}>
          <div className={cn('max-w-400 w-full px-12 mx-auto grid content-start gap-8 h-full')}>
            <PageHeader>
              <PageHeader.Title isLoading={isScorerLoading}>
                <GaugeIcon /> {scorer?.scorer?.config?.name}
              </PageHeader.Title>
              {(isScorerLoading || scorer?.scorer?.config?.description) && (
                <PageHeader.Description isLoading={isScorerLoading}>
                  {scorer?.scorer?.config?.description}
                </PageHeader.Description>
              )}
            </PageHeader>

            <KeyValueList data={scoreInfo} LinkComponent={Link} isLoading={isLoadingAgents || isLoadingWorkflows} />

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

            {isLoadingScores ? (
              <div className="h-full w-full flex items-center justify-center">
                <Spinner />
              </div>
            ) : (
              <ScoresList
                scores={scores}
                selectedScoreId={selectedScoreId}
                pagination={{
                  total: pagination?.total || 0,
                  hasMore: pagination?.hasMore || false,
                  perPage: pagination?.perPage || 0,
                  page: pagination?.page || 0,
                }}
                onScoreClick={handleScoreClick}
                onPageChange={setScoresPage}
                errorMsg={scoresError?.message}
              />
            )}
          </div>
        </div>
      </MainContentLayout>
      <ScoreDialog
        scorerName={scorer?.scorer?.config?.name}
        score={mapScore(scores.find(s => s.id === selectedScoreId))}
        isOpen={dialogIsOpen}
        onClose={() => {
          setDialogIsOpen(false);
          setSelectedScoreId(undefined);
          setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete('scoreId');
            return next;
          });
        }}
        onNext={toNextScore}
        onPrevious={toPreviousScore}
        computeTraceLink={(traceId, spanId) => `/observability?traceId=${traceId}${spanId ? `&spanId=${spanId}` : ''}`}
      />
    </>
  );
}

const mapScore = (score?: ClientScoreRowData): ScoreRowData | undefined => {
  if (!score) return undefined;
  return {
    ...score,
    createdAt: new Date(score.createdAt),
    updatedAt: new Date(score.updatedAt),
  };
};
