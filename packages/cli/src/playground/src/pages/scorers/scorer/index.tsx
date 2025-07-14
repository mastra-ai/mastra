import { AgentIcon, Breadcrumb, Crumb, Header, MainContentLayout, WorkflowIcon } from '@mastra/playground-ui';
import { useParams, Link } from 'react-router';
import { useScorer, useScoresByEntityId, useScoresByScorerId } from '@mastra/playground-ui';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, XIcon } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { useState } from 'react';
import { useAgents } from '@/hooks/use-agents';
import { useWorkflows } from '@/hooks/use-workflows';
import { cn } from '@/lib/utils';
import type { ScoreRowData } from '@mastra/core/eval';
import * as Dialog from '@radix-ui/react-dialog';
import MarkdownRenderer from '@/components/ui/markdown-renderer';
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export default function Scorer() {
  const { scorerId } = useParams()! as { scorerId: string };
  const { scorer, isLoading: scorerLoading } = useScorer(scorerId!);
  const { agents, isLoading: agentsLoading } = useAgents();
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows();
  const isLoading = scorerLoading || agentsLoading || workflowsLoading;

  const [selectedScore, setSelectedScore] = useState<any>(null);
  const [detailsIsOpened, setDetailsIsOpened] = useState<boolean>(false);

  const scorerAgents =
    scorer?.agentIds.map(agentId => {
      return { id: agentId, name: agents?.[agentId]?.name };
    }) || [];

  const scorerWorkflows =
    scorer?.workflowIds.map(workflowId => {
      const legacy = workflows?.[0] || {};
      const current = workflows?.[1] || {};

      return {
        id: workflowId,
        name: legacy[workflowId]?.name || current[workflowId]?.name,
      };
    }) || [];

  const scorerEntities = [
    ...scorerAgents.map(agent => ({ id: agent.id, name: agent.name, type: 'AGENT' })),
    ...scorerWorkflows.map(workflow => ({ id: workflow.id, name: workflow.name, type: 'WORKFLOW' })),
  ];

  const [scoresPage, setScoresPage] = useState<number>(0);
  const { scores: allScores, isLoading: scoresLoading } = useScoresByScorerId(scorerId, scoresPage);
  const [filteredByEntity, setFilteredByEntity] = useState<string>('');
  const { scores: entityScores, isLoading: entityScoresLoading } = useScoresByEntityId(
    filteredByEntity !== '' ? scorerEntities?.[+filteredByEntity]?.name : '',
    filteredByEntity !== '' ? scorerEntities?.[+filteredByEntity]?.type : '',
    scoresPage,
  );

  const scoresTotal = allScores?.pagination?.total || 0;
  const filteredScores = filteredByEntity !== '' ? entityScores?.scores : allScores?.scores;
  const filteredScoresTotal = filteredByEntity !== '' ? entityScores?.pagination.total : allScores?.pagination.total;
  const filteredScoresPage = filteredByEntity !== '' ? entityScores?.pagination.page : allScores?.pagination.page;
  const filteredScoresHasMore =
    filteredByEntity !== '' ? entityScores?.pagination.hasMore : allScores?.pagination.hasMore;
  const filteredScoresPerPage =
    filteredByEntity !== '' ? entityScores?.pagination.perPage : allScores?.pagination.perPage;

  const handleFilterChange = (value: string) => {
    if (value === 'all') {
      setFilteredByEntity('');
      setScoresPage(0); // Reset to first page when filtering by all
    } else {
      const entity = scorerEntities?.[parseInt(value)];
      if (entity) {
        setFilteredByEntity(value);
        setScoresPage(0);
      } else {
        console.warn('Entity not found for value:', value);
      }
    }
  };

  const handleOnListItemClick = (score: any) => {
    if (score.id === selectedScore?.id) {
      setSelectedScore(null);
    } else {
      setSelectedScore(score);
      setDetailsIsOpened(true);
    }
  };

  const toPreviousScore = (currentScore: ScoreRowData) => {
    const currentIndex = allScores?.scores?.findIndex(score => score?.id === currentScore?.id);
    if (currentIndex === -1 || currentIndex === (allScores?.scores?.length || 0) - 1) {
      return null; // No next score
    }

    return () => setSelectedScore(allScores?.scores[(currentIndex || 0) + 1]);
  };

  const toNextScore = (currentScore: ScoreRowData) => {
    const currentIndex = allScores?.scores?.findIndex(score => score?.id === currentScore?.id);
    if ((currentIndex || 0) <= 0) {
      return null; // No previous score
    }
    return () => setSelectedScore(allScores?.scores[(currentIndex || 0) - 1]);
  };

  const handleNextPage = () => {
    if (filteredScoresHasMore) {
      setScoresPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (scoresPage > 0) {
      setScoresPage(prev => prev - 1);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/scorers`}>
            Scorers
          </Crumb>

          <Crumb as={Link} to={`/scorers/${scorerId}`} isCurrent>
            {isLoading ? <Skeleton className="w-20 h-4" /> : scorer?.scorer.name || 'Not found'}
          </Crumb>
        </Breadcrumb>
      </Header>

      {scorer?.scorer ? (
        <>
          <div className={cn(`h-full overflow-y-scroll `)}>
            <div className={cn('max-w-[100rem] px-[3rem] mx-auto')}>
              <ScorerHeader scorer={scorer} agents={scorerAgents} workflows={scorerWorkflows} />
              <ScoreListHeader
                filteredByEntity={filteredByEntity}
                onFilterChange={handleFilterChange}
                scorerEntities={scorerEntities}
                scoresTotal={scoresTotal}
                filteredScoresTotal={filteredByEntity ? filteredScoresTotal : undefined}
              />
              <ScoreList
                scores={filteredScores || []}
                selectedScore={selectedScore}
                onItemClick={handleOnListItemClick}
                isLoading={filteredByEntity !== '' ? entityScoresLoading : scoresLoading || false}
                total={filteredScoresTotal}
                page={filteredScoresPage}
                perPage={filteredScoresPerPage}
                hasMore={filteredScoresHasMore}
                onNextPage={handleNextPage}
                onPrevPage={handlePrevPage}
              />
            </div>
          </div>
          <ScoreDetails
            score={selectedScore}
            isOpen={detailsIsOpened}
            onClose={() => setDetailsIsOpened(false)}
            onNext={toNextScore(selectedScore)}
            onPrevious={toPreviousScore(selectedScore)}
          />
        </>
      ) : null}
    </MainContentLayout>
  );
}

function ScorerHeader({
  scorer,
  agents,
  workflows,
}: {
  scorer: any;
  agents?: { id: string; name: string }[];
  workflows?: { id: string; name: string }[];
}) {
  return (
    <div
      className={cn(
        'grid z-[1] top-0 gap-y-[0.5rem] text-icon4 bg-surface2 py-[3rem]',
        '3xl:h-full 3xl:content-start 3xl:grid-rows-[auto_1fr] h-full 3xl:overflow-y-auto',
      )}
    >
      <div className="grid gap-[1rem] w">
        <h1 className="text-icon6 text-[1.25rem]">{scorer.scorer.name}</h1>
        <p className="m-0 text-[0.875rem]">{scorer.scorer.description}</p>
        <div
          className={cn(
            'flex gap-[1rem] mt-[1rem] text-[0.875rem] items-center mb-[0.25rem]',
            '[&>svg]:w-[1em] [&>svg]:h-[1em] [&>svg]:text-icon3',
          )}
        >
          <span>Entities</span>
          <ArrowRightIcon />
          <div className="flex  gap-[1rem] [&>a]:text-icon4 [&>a:hover]:text-icon5 [&>a]:transition-colors [&>a]:flex [&>a]:items-center [&>a]:gap-[0.5rem] [&>a]:border [&>a]:border-border1 [&>a]:p-[0.25rem] [&>a]:px-[0.5rem] [&>a]:rounded-md [&>a]:text-[0.875rem]">
            {agents?.map(agent => {
              return (
                <Link to={`/agents/${agent.id}/chat`} key={agent.id}>
                  <AgentIcon /> {agent.name || agent.id}
                </Link>
              );
            })}
            {workflows?.map(workflow => {
              return (
                <Link to={`/workflows/${workflow.id}/graph`} key={workflow.id}>
                  <WorkflowIcon /> {workflow.name || workflow.id}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreListHeader({
  filteredByEntity,
  onFilterChange,
  scorerEntities,
  scoresTotal,
  filteredScoresTotal,
}: {
  filteredByEntity: string;
  onFilterChange: (value: string) => void;
  scorerEntities?: { id: string; name: string; type: string }[];
  scoresTotal?: number;
  filteredScoresTotal?: number;
}) {
  return (
    <div className={cn('sticky top-0 bg-surface4 z-[1] mt-[1rem] mb-[1rem] rounded-lg px-[1.5rem]')}>
      <div className="flex items-center justify-between">
        <div className="inline-flex items-baseline gap-[1rem] py-[.75rem]">
          <label htmlFor="filter-by-agent" className="text-icon3 text-[0.875rem] font-semibold whitespace-nowrap">
            Filter by entity:
          </label>
          <Select
            name="filter-by-agent"
            onValueChange={value => {
              onFilterChange(value);
            }}
            defaultValue={'all'}
            value={filteredByEntity || 'all'}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key="all" value="all">
                All
              </SelectItem>
              {(scorerEntities || []).map((entity, idx) => (
                <SelectItem key={entity.id} value={`${idx}`}>
                  <div className="flex items-center gap-[0.5rem] [&>svg]:w-[1.2em] [&>svg]:h-[1.2em] [&>svg]:text-icon3">
                    {entity.type === 'WORKFLOW' ? <WorkflowIcon /> : <AgentIcon />}
                    {entity.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-icon3 text-[0.875rem] flex gap-[1rem] [&_b]:text-icon5 [&>span]:flex [&>span]:gap-[0.5rem]">
          {filteredScoresTotal && (
            <span>
              Filtered: <b>{filteredScoresTotal}</b>
            </span>
          )}
          <span>
            Total: <b>{scoresTotal}</b>
          </span>
        </div>
      </div>

      <div
        className={cn(
          'grid gap-[1rem] grid-cols-[7rem_7rem_1fr_2fr_10rem_3rem] text-left text-[0.75rem] text-icon3 uppercase py-[1rem] border-t border-border1 ',
        )}
      >
        <span>Date</span>
        <span>Time</span>
        <span>Input</span>
        <span>Output</span>
        <span>Entity</span>
        <span>Score</span>
      </div>
    </div>
  );
}

function ScoreList({
  scores,
  selectedScore,
  onItemClick,
  isLoading,
  total,
  page,
  hasMore,
  onNextPage,
  onPrevPage,
  perPage,
}: {
  scores: ScoreRowData[];
  selectedScore: any;
  onItemClick?: (score: ScoreRowData) => void;
  isLoading?: boolean;
  total?: number;
  page?: number;
  hasMore?: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  perPage?: number;
}) {
  if (isLoading) {
    return (
      <div className="flex border border-border1 w-full h-[3.5rem] items-center justify-center text-[0.875rem] text-icon3 rounded-lg">
        Loading...
      </div>
    );
  }

  return (
    <div className="grid gap-[2rem] mb-[3rem]">
      <ul className="grid border border-border1f bg-surface3 rounded-xl ">
        {scores?.length === 0 && (
          <li className="text-icon3 text-[0.875rem] text-center h-[3.5rem] items-center flex justify-center">
            No scores found for this scorer.
          </li>
        )}
        {scores?.length > 0 &&
          scores.map(score => {
            return <ScoreItem key={score.id} score={score} selectedScore={selectedScore} onClick={onItemClick} />;
          })}
      </ul>

      {typeof page === 'number' && typeof perPage === 'number' && typeof total === 'number' && (
        <div className={cn('flex items-center justify-center text-icon3 text-[0.875rem] gap-[2rem]')}>
          <span>
            Page {page ? page + 1 : '1'} of {total ? Math.ceil(total / perPage) : 0}
          </span>
          <div
            className={cn(
              'flex gap-[1rem]',
              '[&>button]:flex [&>button]:items-center [&>button]:gap-[0.5rem] [&>button]:text-icon4 [&>button:hover]:text-icon5 [&>button]:transition-colors [&>button]:border [&>button]:border-border1 [&>button]:p-[0.25rem] [&>button]:px-[0.5rem] [&>button]:rounded-md',
              ' [&_svg]:w-[1em] [&_svg]:h-[1em] [&_svg]:text-icon3',
            )}
          >
            {typeof page === 'number' && page > 0 && (
              <button onClick={onPrevPage} disabled={page === 0}>
                <ArrowLeftIcon />
                Previous
              </button>
            )}
            {hasMore && (
              <button onClick={onNextPage} disabled={!hasMore}>
                Next
                <ArrowRightIcon />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreItem({
  score,
  selectedScore,
  onClick,
}: {
  score: ScoreRowData;
  selectedScore: any | null;
  onClick?: (score: any) => void;
}) {
  const isSelected = selectedScore?.id === score.id;

  const handleClick = () => {
    return onClick && onClick(score);
  };

  const isTodayDate = isToday(new Date(score.createdAt));
  const dateStr = format(new Date(score.createdAt), 'MMM d yyyy');
  const timeStr = format(new Date(score.createdAt), 'h:mm:ss bb');
  const inputPrev = score?.input?.[0]?.content || score?.input?.[0]?.ingredient || '';
  const outputPrev = score?.output?.text || score?.output?.object?.result || '';
  const scorePrev = score?.score ? Math.round(score?.score * 100) / 100 : 'n/a';
  const entityIcon = score?.entityType === 'WORKFLOW' ? <WorkflowIcon /> : <AgentIcon />; // score?.score?.toFixed(2) || `N/A`;

  return (
    <li
      key={score.id}
      className={cn('scorerListItem border-b text-[#ccc] border-border1 last:border-b-0 text-[0.875rem]', {
        'bg-surface5': isSelected,
      })}
    >
      <button
        onClick={handleClick}
        className={cn(
          'grid w-full px-[1.5rem] gap-[1rem] text-left items-center min-h-[3.5rem] grid-cols-[7rem_7rem_1fr_2fr_10rem_3rem] ',
        )}
      >
        <span className="text-icon4">{isTodayDate ? 'Today' : dateStr}</span>
        <span className="text-icon4">{timeStr}</span>
        <span className="truncate pr-[1rem]">{inputPrev}</span>
        <span className="truncate pr-[1rem]">{outputPrev}</span>
        <span className="pr-[1rem] flex gap-[0.5rem] items-center [&>svg]:shrink-0 [&>svg]:w-[1em] [&>svg]:h-[1em] [&>svg]:text-icon3 text-[0.875rem]">
          {entityIcon} <span className="truncate">{score.entityId}</span>
        </span>
        <span>{scorePrev}</span>
      </button>
    </li>
  );
}

function ScoreDetails({
  isOpen,
  score,
  onClose,
  onPrevious,
  onNext,
}: {
  isOpen: boolean;
  score: ScoreRowData;
  onClose?: () => void;
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
}) {
  if (!score) {
    return null;
  }

  console.log('-->>', score);

  const handleOnNext = () => {
    if (onNext) {
      onNext();
    }
  };

  const handleOnPrevious = () => {
    if (onPrevious) {
      onPrevious();
    }
  };

  // Mock prompts for demonstration purposes
  // When backend is updated, these would be get from score property
  const mockPrompts = {
    extract: {
      prompt: 'Extract the ingredients from the input text.',
      description: 'Extracts ingredients from the input text.',
    },
    score: {
      prompt: 'Score the recipe based on the extracted ingredients.',
      description: 'Scores the recipe based on the extracted ingredients.',
    },
    reason: {
      prompt: 'Provide a reason for the score given to the recipe.',
      description: 'Provides a reason for the score given to the recipe.',
    },
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black top-0 bottom-0 right-0 left-0 fixed z-[10] opacity-[0.1]" />
        <Dialog.Content
          className={cn(
            'fixed top-0 bottom-0 right-0 border-l border-border1 w-[70rem] max-w-[calc(100vw-15rem)] z-[100] bg-surface4 px-[1rem] overflow-y-scroll',
          )}
        >
          <div className="bg-surface4 border-b-2 border-border1 flex items-center py-[1.5rem] px-[1rem] top-0 sticky">
            <h2 className=" w-full text-[0.875rem] !text-icon5 !font-normal flex items-center gap-[1rem]">
              <span>{score.id}</span>|<span>{format(new Date(score.createdAt), 'LLL do yyyy, hh:mm:ss bb')}</span>
            </h2>
            <div className="flex gap-[1rem]">
              <Button variant={'outline'} onClick={handleOnNext} disabled={!onNext}>
                Next
                <ArrowUpIcon />
              </Button>
              <Button variant={'outline'} onClick={handleOnPrevious} disabled={!onPrevious}>
                Previous
                <ArrowDownIcon />
              </Button>
              <Dialog.Close asChild>
                <button
                  className="inline-flex bg-surface5 appearance-none items-center justify-center rounded-md p-[.2rem] focus:shadow-[0_0_0_2px] focus:outline-none"
                  aria-label="Close"
                >
                  <XIcon />
                </button>
              </Dialog.Close>
            </div>
          </div>

          <div className="grid gap-[2rem] px-[1rem] py-[2rem] pb-[4rem] ">
            <section
              className={cn(
                'p-[1.5rem] rounded-lg px-[2rem] bg-surface5 grid grid-cols-[5rem_1fr] gap-x-[2rem]',
                '[&>em]:flex [&>em]:justify-between',
                '[&_svg]:w-[1.1em] [&>svg]:h-[1.1em] [&_svg]:text-icon3 ',
                '[&_b]:text-icon6 [&_b]:font-semibold',
                'text-[0.875rem]',
              )}
            >
              <em>
                Score <ArrowRightIcon />
              </em>
              <b>{score?.score || 'n/a'}</b>
              <em>
                Reason <ArrowRightIcon />
              </em>
              <MarkdownRenderer>{score?.reason || 'n/a'}</MarkdownRenderer>
            </section>
            <section className="border border-border1 rounded-lg">
              <h3 className="p-[1rem] px-[1.5rem] border-b border-border1">Input</h3>
              {(score.input || []).map((input: any, index: number) => (
                <div
                  key={index}
                  className="border-b border-border1 last:border-b-0 py-[1rem] px-[1.5rem] text-[0.875rem] text-icon4"
                >
                  {input?.content && <MarkdownRenderer>{input.content}</MarkdownRenderer>}
                  {input?.ingredient && <MarkdownRenderer>{input.ingredient}</MarkdownRenderer>}
                </div>
              ))}
            </section>
            <section className="border border-border1 rounded-lg">
              <div className="border-b border-border1 last:border-b-0">
                <div className="flex items-center justify-between border-b border-border1 p-[1rem] px-[1.5rem]">
                  <h3>Output</h3>
                  {score.output?.usage && (
                    <div className="flex gap-[1rem] text-[0.875rem] text-icon4 [&_b]:text-icon5">
                      <span>Token usage</span>|
                      <span>
                        Completion: <b>{score.output?.usage?.completionTokens}</b>
                      </span>
                      <span>
                        Prompt: <b>{score.output?.usage?.promptTokens}</b>
                      </span>
                      |
                      <span>
                        Total: <b>{score.output?.usage?.totalTokens}</b>
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-icon4 text-[0.875rem] p-[1.5rem] py-[1rem] ">
                  {score.output?.text && <MarkdownRenderer>{score.output.text}</MarkdownRenderer>}
                  {score.output?.object?.result && <MarkdownRenderer>{score.output.object.result}</MarkdownRenderer>}
                </div>
              </div>
            </section>
            {mockPrompts && (
              <section className="border border-border1 rounded-lg">
                <div className="flex items-center justify-between  p-[1rem] ">
                  <h3 className="px-[.5rem]">Prompts</h3>
                </div>

                {Object.entries(mockPrompts || {}).map(([key, value]) => (
                  <>
                    <div className="flex gap-[1rem] text-[]  py-[1rem] px-[1.5rem] border-y border-border1" key={key}>
                      <span className="text-icon5 font-bold text-[0.875rem]">{key}</span>
                      <span className="text-icon2 text-[0.75rem]">{value?.description && `|`}</span>
                      <span className="text-icon4 text-[0.875rem]">{value?.description || ''}</span>
                    </div>
                    <div className="text-icon4 text-[0.875rem] py-[1rem] mx-[1.5rem] px-[1rem] font-mono ">
                      {value?.prompt && <MarkdownRenderer>{value.prompt}</MarkdownRenderer>}
                    </div>
                  </>
                ))}
              </section>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
