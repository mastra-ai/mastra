import { Breadcrumb, Crumb, Header, MainContentLayout } from '@mastra/playground-ui';
import { useParams, Link } from 'react-router';
import { useScorer, useScoresByScorerId } from '@mastra/playground-ui';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, XIcon } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { useEffect, useState } from 'react';
import { useAgents } from '@/hooks/use-agents';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type GetScorerResponse, type ScoreRowData } from '@mastra/client-js';

import * as Dialog from '@radix-ui/react-dialog';

import MarkdownRenderer from '@/components/ui/markdown-renderer';
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export default function Scorer() {
  const { scorerId } = useParams();
  const { scorer, isLoading: isLoadingScorer } = useScorer(scorerId!);
  const { agents, isLoading: isLoadingAgents } = useAgents();
  const scorerAgents =
    scorer?.agentIds.map(agentId => {
      return { id: agentId, name: agents?.[agentId]?.name };
    }) || [];
  const isLoading = isLoadingScorer || isLoadingAgents;
  const [filteredByEntityId, setFilteredByEntityId] = useState<string>('all');
  const [selectedScore, setSelectedScore] = useState<any>(null);
  const [detailsIsOpened, setDetailsIsOpened] = useState<boolean>(false);

  // temporary solution to get all scores for the scorer, replace with fetching api getScoresByScorerId when available
  const [allScores, setAllScores] = useState<ScoreRowData[]>([]);
  const addToAllScores = (scores: ScoreRowData[]) => {
    if (!scores || scores.length === 0) return;
    const existingIds = new Set(allScores.map(score => score.id));
    const newScores = scores.filter(score => !existingIds.has(score.id));
    if (newScores.length > 0) {
      setAllScores([...allScores, ...newScores]);
    }
  };

  // if (scorer) {
  //   scorer.prompts = {
  //     extract: { prompt: 'prompt string', description: 'prompt description' },
  //     score: { prompt: 'prompt string', description: 'prompt description' },
  //     reason: { prompt: 'prompt string', description: 'prompt description' },
  //   };
  // }

  const handleOnListItemClick = (score: any) => {
    if (score.id === selectedScore?.id) {
      setSelectedScore(null);
    } else {
      setSelectedScore(score);
      setDetailsIsOpened(true);
    }
  };

  const toPreviousScore = (currentScore: ScoreRowData) => {
    const currentIndex = allScores.findIndex(score => score?.id === currentScore?.id);
    if (currentIndex === -1 || currentIndex === allScores.length - 1) {
      return null; // No next score
    }

    return () => setSelectedScore(allScores[currentIndex + 1]);
  };

  const toNextScore = (currentScore: ScoreRowData) => {
    const currentIndex = allScores.findIndex(score => score?.id === currentScore?.id);
    if (currentIndex <= 0) {
      return null; // No previous score
    }
    return () => setSelectedScore(allScores[currentIndex - 1]);
  };

  const hasPrompts = Object.keys(scorer?.prompts || {}).length > 0;

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
              <ScorerHeader scorer={scorer} scorerAgents={scorerAgents} />
              <Tabs defaultValue="scores">
                <TabsList
                  className={cn(
                    'flex border-b group',
                    '[&>button]:text-icon3 [&>button]:text-[1rem] [&>button]:px-[1.5rem] [&>button]:py-[0.75rem] [&>button]:border-b-2 [&>button]:border-transparent ',
                    '[&>button[data-state=active]]:bg-surface2 [&>button[data-state=active]]:text-icon5 [&>button[data-state=active]]:border-icon5',
                  )}
                >
                  <TabsTrigger value="scores" className="group">
                    Scores
                  </TabsTrigger>
                  <TabsTrigger
                    value="prompts"
                    className={cn('group', {
                      'cursor-not-allowed': !hasPrompts,
                    })}
                    disabled={!hasPrompts}
                  >
                    Prompts
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="scores">
                  <ScoreListHeader
                    setFilteredByEntityId={setFilteredByEntityId}
                    filteredByEntityId={filteredByEntityId}
                    scorerAgents={scorerAgents}
                  />
                  <ScoreList
                    scorerId={scorerId}
                    scorer={scorer}
                    filteredByEntityId={filteredByEntityId}
                    selectedScore={selectedScore}
                    setSelectedScore={setSelectedScore}
                    onItemClick={handleOnListItemClick}
                    addToAllScores={addToAllScores}
                  />
                </TabsContent>
                <TabsContent value="prompts">
                  <ScorerPrompts prompts={scorer?.prompts} />
                </TabsContent>
              </Tabs>
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

function ScorerHeader({ scorer, scorerAgents }: { scorer: any; scorerAgents?: { id: string; name: string }[] }) {
  return (
    <div
      className={cn(
        'grid z-[1] top-0 gap-y-[0.5rem] text-icon4 bg-surface2 py-[3rem]',
        '3xl:h-full 3xl:content-start 3xl:grid-rows-[auto_1fr] h-full 3xl:overflow-y-auto',
      )}
    >
      <div className="grid gap-[1rem] w">
        <h1 className="text-icon6 text-[1.25rem]">{scorer.scorer.name}</h1>
        <p className="m-0">{scorer.scorer.description}</p>
        <div
          className={cn(
            'flex gap-[1rem] mt-[1rem] text-[0.875rem] items-center mb-[0.25rem]',
            '[&>svg]:w-[1em] [&>svg]:h-[1em] [&>svg]:text-icon3',
          )}
        >
          <span>Agents</span>
          <ArrowRightIcon />
          <div>
            {scorerAgents?.map(agent => {
              return <span key={agent.id}>{agent.name}</span>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreListHeader({
  setFilteredByEntityId,
  filteredByEntityId,
  scorerAgents,
}: {
  setFilteredByEntityId: (value: string) => void;
  filteredByEntityId: string;
  scorerAgents?: { id: string; name: string }[];
}) {
  return (
    <div className={cn('sticky top-0 bg-surface2 z-[1] pt-[1rem] mt-[3rem]')}>
      <div className="mb-[1rem] inline-flex items-baseline gap-[1rem] ">
        <label
          htmlFor="filter-by-agent"
          className="text-icon3 text-[0.875rem] font-semibold mb-[0.5rem] whitespace-nowrap"
        >
          Filter by agent:
        </label>
        <Select
          name="filter-by-agent"
          onValueChange={value => {
            setFilteredByEntityId(value);
          }}
          defaultValue={'all'}
          value={filteredByEntityId}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem key="all" value="all">
              All Agents
            </SelectItem>
            {(scorerAgents || []).map(agent => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className={cn(
          'grid gap-[1rem] bg-surface3 rounded-lg mb-[0.5rem] px-[1.5rem] py-[1rem] grid-cols-[7rem_7rem_1fr_2fr_9rem_3rem] text-left text-[0.75rem] text-icon3 uppercase',
        )}
      >
        <span>Date</span>
        <span>Time</span>
        <span>Input</span>
        <span>Output</span>
        <span>Agent</span>
        <span>Score</span>
        <span className="w-[1.5rem]"></span>
      </div>
    </div>
  );
}

function ScoreList({
  scorerId,
  scorer,
  filteredByEntityId,
  selectedScore,
  onItemClick,
  addToAllScores,
}: {
  scorer: GetScorerResponse;
  filteredByEntityId: string;
  selectedScore: any;
  setSelectedScore: (value: ScoreRowData) => void;
  onItemClick?: (score: ScoreRowData) => void;
  addToAllScores?: (scores: ScoreRowData[]) => void;
}) {
  return (
    <ul className="grid border border-border1f bg-surface3 rounded-xl mb-[5rem]">
      <ScoresForScorer
        key={scorerId}
        scorerId={scorerId}
        selectedScore={selectedScore}
        onItemClick={onItemClick}
        addToAllScores={addToAllScores}
      />
    </ul>
  );
}

function ScoresForScorer({
  scorerId,
  selectedScore,
  onItemClick,
  addToAllScores,
}: {
  agentId: string;
  selectedScore: any;
  onItemClick?: (score: any) => void;
  addToAllScores?: (scores: ScoreRowData[]) => void;
}) {
  const [scoresAdded, setScoresAdded] = useState(false);
  const { scores, isLoading } = useScoresByScorerId(scorerId);

  useEffect(() => {
    if (!scoresAdded && scores?.scores && scores?.scores.length > 0) {
      addToAllScores?.(scores?.scores || []);
      setScoresAdded(true);
    }
  }, [scores, addToAllScores, isLoading]);

  return scores?.scores.map(score => (
    <ScoreItem key={score.id} score={score} selectedScore={selectedScore} onClick={onItemClick} />
  ));
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
  const inputPrev = score?.input?.[0]?.content || '';
  const outputPrev = score?.output?.text || '';
  const scorePrev = score?.score || `N/A`;

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
          'grid w-full px-[1.5rem] gap-[1rem] text-left items-center min-h-[4rem] grid-cols-[7rem_7rem_1fr_2fr_9rem_3rem] ',
        )}
      >
        <span className="text-icon4">{isTodayDate ? 'Today' : dateStr}</span>
        <span className="text-icon4">{timeStr}</span>
        <span className="truncate pr-[1rem]">{inputPrev}</span>
        <span className="truncate pr-[1rem]">{outputPrev}</span>
        <span className="truncate pr-[1rem]">{score.entityId}</span>
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
                  className="border-b border-border1 last:border-b-0 py-[1rem] px-[1.5rem] text-[0.875rem] text-icon5"
                >
                  <MarkdownRenderer>{input.content}</MarkdownRenderer>
                </div>
              ))}
            </section>
            <section className="border border-border1 rounded-lg">
              <div className="border-b border-border1 last:border-b-0">
                <div className="flex items-center justify-between border-b border-border1 p-[1rem] px-[1.5rem]">
                  <h3>Output</h3>
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
                </div>
                <div className="text-icon5 text-[0.875rem] p-[1.5rem] pt-[0.5rem] ">
                  <MarkdownRenderer>{score.output?.text}</MarkdownRenderer>
                </div>
              </div>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ScorerPrompts({ prompts }: { prompts: GetScorerResponse['prompts'] | undefined }) {
  if (!prompts) {
    return null;
  }

  return (
    <div className="grid gap-[2rem] my-[2rem] items-start">
      {Object.entries(prompts || {}).map(([key, value]) => (
        <div className="" key={key}>
          <div className="flex gap-[1rem] mb-[.5rem]">
            <span className="text-icon5 font-bold">{key}</span>
            <span className="text-icon2">{value?.description && `|`}</span>
            <span className="text-icon4">{value?.description || ''}</span>
          </div>
          <div className={`rounded-md border border-border1 bg-surface1 `}>
            <pre className="text-[0.875rem] text-[#ccc] p-[1rem] whitespace-pre-wrap font-mono">{value.prompt}</pre>
          </div>
        </div>
      ))}
    </div>
  );
}
