import {
  Breadcrumb,
  Crumb,
  EntryList,
  Header,
  MainContentLayout,
  PageHeader,
  ScoresTools,
  ScoreDialog,
  type ScoreEntityOption as EntityOptions,
  KeyValueList,
  useScorer,
  useScoresByScorerId,
} from '@mastra/playground-ui';
import { useParams, Link, useSearchParams } from 'react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { GaugeIcon } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { useEffect, useState } from 'react';
import { useAgents } from '@/hooks/use-agents';
import { cn } from '@/lib/utils';
import { useWorkflows } from '@/hooks/use-workflows';

const listColumns = [
  { name: 'date', label: 'Date', size: '4.5rem' },
  { name: 'time', label: 'Time', size: '6.5rem' },
  { name: 'input', label: 'Input', size: '1fr' },
  { name: 'entityId', label: 'Entity', size: '10rem' },
  { name: 'score', label: 'Score', size: '3rem' },
];

type ScoreItem = {
  id: string;
  date: string;
  time: string;
  input: string;
  entityId: string;
  score: number;
};

export default function Scorer() {
  const { scorerId } = useParams()! as { scorerId: string };
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedScoreId, setSelectedScoreId] = useState<string | undefined>();

  const { scorer, isLoading: isScorerLoading } = useScorer(scorerId!);
  const { data: agents, isLoading: isLoadingAgents } = useAgents();
  const { data: workflows, isLoading: isLoadingWorkflows } = useWorkflows();

  const [selectedEntityOption, setSelectedEntityOption] = useState<EntityOptions | undefined>({
    value: 'all',
    label: 'All',
    type: 'ALL' as const,
  });
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);

  const agentOptions: EntityOptions[] =
    scorer?.agentIds?.map(agentId => {
      return { value: agentId, label: agentId, type: 'AGENT' as const };
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
        path: `${entity.type === 'AGENT' ? '/agents' : '/workflows'}/${entity.id}`,
      })),
    },
  ];

  const handleSelectedEntityChange = (option: EntityOptions | undefined) => {
    option?.value && setSearchParams({ entity: option?.value });
  };

  const [scoresPage, setScoresPage] = useState<number>(0);

  const { scores: scoresData, isLoading: isScoresLoading } = useScoresByScorerId({
    scorerId,
    page: scoresPage,
    entityId: selectedEntityOption?.value === 'all' ? undefined : selectedEntityOption?.value,
    entityType: selectedEntityOption?.type === 'ALL' ? undefined : selectedEntityOption?.type,
  });

  const scores = scoresData?.scores || [];
  const scoresTotal = scoresData?.pagination.total;
  const scoresHasMore = scoresData?.pagination.hasMore;
  const scoresPerPage = scoresData?.pagination.perPage;

  const items: ScoreItem[] = scores.map(score => {
    const createdAtDate = new Date(score.createdAt);
    const isTodayDate = isToday(createdAtDate);

    return {
      id: score.id,
      date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
      time: format(createdAtDate, 'h:mm:ss aaa'),
      input: score?.input?.inputMessages?.[0]?.content || '',
      entityId: score.entityId,
      score: score.score,
    };
  });

  const handleOnListItem = (id: string) => {
    if (id === selectedScoreId) {
      return setSelectedScoreId(undefined);
    }

    setSelectedScoreId(id);
    setDialogIsOpen(true);
  };

  const toNextItem = () => {
    const currentIndex = scores.findIndex(item => item.id === selectedScoreId);
    const nextItem = scores[currentIndex + 1];

    if (nextItem) {
      setSelectedScoreId(nextItem.id);
    }
  };

  const toPreviousItem = () => {
    const currentIndex = scores.findIndex(item => item.id === selectedScoreId);
    const previousItem = scores[currentIndex - 1];

    if (previousItem) {
      setSelectedScoreId(previousItem.id);
    }
  };

  const thereIsNextItem = () => {
    const currentIndex = scores.findIndex(item => item.id === selectedScoreId);
    return currentIndex < scores.length - 1;
  };

  const thereIsPreviousItem = () => {
    const currentIndex = scores.findIndex(item => item.id === selectedScoreId);
    return currentIndex > 0;
  };

  const handleNextPage = () => {
    if (scoresHasMore) {
      setScoresPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (scoresPage > 0) {
      setScoresPage(prev => prev - 1);
    }
  };

  return (
    <>
      <MainContentLayout>
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to={`/scorers`}>
              Scorers
            </Crumb>

            <Crumb as={Link} to={`/scorers/${scorerId}`} isCurrent>
              {isScorerLoading ? <Skeleton className="w-20 h-4" /> : scorer?.scorer.config.name || 'Not found'}
            </Crumb>
          </Breadcrumb>
        </Header>

        <div className={cn(`grid overflow-y-auto h-full`)}>
          <div className={cn('max-w-[100rem] w-full px-[3rem] mx-auto grid content-start gap-[2rem] h-full')}>
            <PageHeader
              title={scorer?.scorer?.config?.name}
              description={scorer?.scorer?.config?.description}
              icon={<GaugeIcon />}
            />
            <KeyValueList data={scoreInfo} LinkComponent={Link} isLoading={isLoadingAgents || isLoadingWorkflows} />
            <ScoresTools
              selectedEntity={selectedEntityOption}
              entityOptions={entityOptions}
              onEntityChange={handleSelectedEntityChange}
              onReset={() => setSearchParams({ entity: 'all' })}
              isLoading={isScoresLoading || isLoadingAgents || isLoadingWorkflows}
            />
            <EntryList
              items={items}
              selectedItemId={selectedScoreId}
              onItemClick={handleOnListItem}
              columns={listColumns}
              isLoading={isScoresLoading}
              page={scoresPage}
              perPage={scoresPerPage}
              hasMore={scoresHasMore}
              total={scoresTotal || 0}
              onNextPage={handleNextPage}
              onPrevPage={handlePrevPage}
            />
          </div>
        </div>
      </MainContentLayout>
      <ScoreDialog
        scorer={scorer?.scorer}
        score={scores.find(s => s.id === selectedScoreId)!}
        isOpen={dialogIsOpen}
        onClose={() => setDialogIsOpen(false)}
        onNext={thereIsNextItem() ? toNextItem : undefined}
        onPrevious={thereIsPreviousItem() ? toPreviousItem : undefined}
      />
    </>
  );
}
