import {
  Breadcrumb,
  Crumb,
  ScoresList,
  scoresListColumns,
  Header,
  MainContentLayout,
  PageHeader,
  ScoresTools,
  ScoreDialog,
  type ScoreEntityOption as EntityOptions,
  KeyValueList,
  useScorer,
  useScoresByScorerId,
  Icon,
  HeaderAction,
  Button,
  DocsIcon,
  EntryListSkeleton,
  getToNextEntryFn,
  getToPreviousEntryFn,
  useAgents,
  useWorkflows,
  HeaderGroup,
  ScorerCombobox,
  toast,
} from '@mastra/playground-ui';
import { useParams, Link, useSearchParams } from 'react-router';
import { GaugeIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export default function Scorer() {
  const { scorerId } = useParams()! as { scorerId: string };
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedScoreId, setSelectedScoreId] = useState<string | undefined>();
  const [scoresPage, setScoresPage] = useState<number>(0);
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);

  const [selectedEntityOption, setSelectedEntityOption] = useState<EntityOptions | undefined>({
    value: 'all',
    label: 'All',
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

  const agentOptions: EntityOptions[] =
    scorer?.agentIds?.map(agentId => {
      return { value: agentId, label: agents[agentId].name, type: 'AGENT' as const };
    }) || [];

  const workflowOptions: EntityOptions[] =
    scorer?.workflowIds?.map(workflowId => {
      return { value: workflowId, label: workflowId, type: 'WORKFLOW' as const };
    }) || [];

  const entityOptions: EntityOptions[] = [
    { value: 'all', label: 'All', type: 'ALL' as const },
    ...agentOptions,
    ...workflowOptions,
  ];

  useEffect(() => {
    if (entityOptions) {
      const entityName = searchParams.get('entity');
      const entityOption = entityOptions.find(option => option.value === entityName);
      if (entityOption && entityOption.value !== selectedEntityOption?.value) {
        setSelectedEntityOption(entityOption);
      }
    }
  }, [searchParams, selectedEntityOption, entityOptions]);

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

  if (isScorerLoading || scorerError || agentsError || workflowsError) return null;

  const scorerAgents =
    scorer?.agentIds.map(agentId => {
      return {
        name: agentId,
        id: Object.entries(agents).find(([_, value]) => value.name === agentId)?.[0],
      };
    }) || [];

  const scorerWorkflows =
    scorer?.workflowIds.map(workflowId => {
      return {
        name: workflowId,
        id: Object.entries(workflows || {}).find(([_, value]) => value.name === workflowId)?.[0],
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
    option?.value && setSearchParams({ entity: option?.value });
  };

  const scores = scoresData?.scores || [];
  const pagination = scoresData?.pagination;

  const handleScoreClick = (id: string) => {
    setSelectedScoreId(id);
    setDialogIsOpen(true);
  };

  const toNextScore = getToNextEntryFn({ entries: scores, id: selectedScoreId, update: setSelectedScoreId });
  const toPreviousScore = getToPreviousEntryFn({ entries: scores, id: selectedScoreId, update: setSelectedScoreId });

  return (
    <>
      <MainContentLayout>
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to={`/scorers`} isCurrent>
              <Icon>
                <GaugeIcon />
              </Icon>
              Scorers
            </Crumb>
          </Breadcrumb>

          <HeaderGroup>
            <div className="w-[240px]">
              <ScorerCombobox value={scorerId} />
            </div>
          </HeaderGroup>

          <HeaderAction>
            <Button as={Link} to="https://mastra.ai/en/docs/scorers/overview" target="_blank">
              <Icon>
                <DocsIcon />
              </Icon>
              Scorers documentation
            </Button>
          </HeaderAction>
        </Header>

        <div className={cn(`grid overflow-y-auto h-full`)}>
          <div className={cn('max-w-[100rem] w-full px-[3rem] mx-auto grid content-start gap-[2rem] h-full')}>
            <PageHeader
              title={scorer?.scorer?.config?.name || 'loading'}
              description={scorer?.scorer?.config?.description || 'loading'}
              icon={<GaugeIcon />}
            />

            <KeyValueList data={scoreInfo} LinkComponent={Link} isLoading={isLoadingAgents || isLoadingWorkflows} />

            <ScoresTools
              selectedEntity={selectedEntityOption}
              entityOptions={entityOptions}
              onEntityChange={handleSelectedEntityChange}
              onReset={() => setSearchParams({ entity: 'all' })}
              isLoading={isLoadingScores || isLoadingAgents || isLoadingWorkflows}
            />

            {isLoadingScores ? (
              <EntryListSkeleton columns={scoresListColumns} />
            ) : (
              <ScoresList
                scores={scores}
                selectedScoreId={selectedScoreId}
                pagination={pagination}
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
        score={scores.find(s => s.id === selectedScoreId)}
        isOpen={dialogIsOpen}
        onClose={() => setDialogIsOpen(false)}
        onNext={toNextScore}
        onPrevious={toPreviousScore}
        computeTraceLink={(traceId, spanId) => `/observability?traceId=${traceId}${spanId ? `&spanId=${spanId}` : ''}`}
      />
    </>
  );
}
