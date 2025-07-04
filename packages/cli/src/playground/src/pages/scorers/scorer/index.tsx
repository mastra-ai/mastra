import { Breadcrumb, Crumb, Header, MainContentContent, MainContentLayout, Txt } from '@mastra/playground-ui';
import { useParams, Link } from 'react-router';
import { useScorer, useScoresByEntityId } from '@/hooks/use-scorers';
import { Skeleton } from '@/components/ui/skeleton';
import { CodeDisplay } from '@/components/ui/code-display';
import { ChevronDownIcon, CodeIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { cn } from '@/lib/utils';

function AgentScore({ score }: { score: any }) {
  const [isExpanded, setIsExpanded] = useState(false);

  console.log({ score });

  return (
    <article
      key={score.id}
      className={cn('border-b border-border1 last:border-b-0 text-[0.875rem]', {
        'bg-surface4': isExpanded,
      })}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn('grid w-full p-4 px-6 hover:bg-surface4', {
          'hover:bg-surface5': isExpanded,
        })}
      >
        <h3
          className={cn(
            'grid grid-cols-[9rem_8rem_1fr_2fr_5rem_auto] text-left [&>svg]:w-[1.2rem] [&>svg]:h-[1.2rem] [&>svg]:text-icon5',
            { '[&>svg]:rotate-180': isExpanded },
          )}
        >
          <span>{score.id.split('-').pop()}</span>
          <span>{format(new Date(score.createdAt), 'h:mm:ss bb')}</span>
          <span className="truncate">{isExpanded ? '' : score.result.input}</span>
          <span className="truncate">{isExpanded ? '' : score.result.output}</span>
          <span>{score.result.score}</span>
          <ChevronDownIcon />
        </h3>
      </button>
      {isExpanded && (
        <div className="m-[1.5rem] mt-0 border-t border-border1 pt-[1rem]">
          <dl className="grid grid-cols-[auto_1fr] gap-x-[2rem] gap-y-[0.25rem] [&>dt]:text-icon3 [&>dd]:max-w-[80ch] ">
            <dt>Input:</dt>
            <dd>{score.result.input}</dd>
            <dt>Output:</dt>
            <dd>{score.result.output}</dd>
            <dt>Score:</dt>
            <dd>{score.result.score}</dd>
            <dt>Reason:</dt>
            <dd>{score.result.reason}</dd>
          </dl>
        </div>
      )}

      {/* <div className="overflow-x-auto max-w-[60rem] border border-border1">
        <pre>{JSON.stringify(score, null, 2)}</pre>
      </div> */}
    </article>
  );
}

function AgentScores({ agentId }: { agentId: string }) {
  const { scores, isLoading } = useScoresByEntityId(agentId, 'AGENT');
  const [isExpanded, setIsExpanded] = useState(false);

  return scores?.scores.map(score => <AgentScore score={score} />);
}

export default function Scorer() {
  const { scorerId } = useParams();
  const { scorer, isLoading } = useScorer(scorerId!);

  console.log({ scorer, isLoading });

  if (isLoading) {
    return null;
  }

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/mcps`}>
            Scorers
          </Crumb>

          <Crumb as={Link} to={`/scorers/${scorerId}`} isCurrent>
            {isLoading ? <Skeleton className="w-20 h-4" /> : scorer?.scorer.name || 'Not found'}
          </Crumb>
        </Breadcrumb>
      </Header>

      {scorer?.scorer ? (
        <MainContentContent className="grid grid-cols-[1fr_2fr] gap-[2rem] px-[2rem] py-[2rem]">
          <div className="">
            <Txt as="h1" variant="header-md" className="text-icon6 font-medium pb-4">
              {scorer.scorer.name}
            </Txt>
            <Txt as="p" variant="ui-lg" className="text-icon3">
              {scorer.scorer.description}
            </Txt>
            <dl className="grid grid-cols-[auto_1fr] gap-[.5rem] mt-6 text-ui-md [&>dt]:text-icon3">
              <dt>Sampling Type:</dt>
              <dd>{scorer?.sampling?.type}</dd>
              <dt>Sampling Rate:</dt>
              <dd>{scorer?.sampling?.type === 'ratio' ? scorer?.sampling?.rate : 'None'}</dd>
            </dl>
            <Txt as="h2" variant="header-md" className=" mt-8 mb-4">
              Prompts
            </Txt>
            <ul className="grid gap-[2rem]">
              {Object.entries(scorer?.prompts || {}).map(([key, value]) => (
                <li key={key}>
                  <Txt
                    as="h3"
                    variant="ui-md"
                    className="uppercase flex gap-3 [&>svg]:text-icon3 [&>svg]:w-[1.5em] [&>svg]:h-[1.5em] items-center"
                  >
                    <CodeIcon />
                    {key}
                  </Txt>

                  <CodeDisplay
                    content={value.prompt || ''}
                    // isCopied={isCopied}
                    // isDraft={!!enhancedPrompt}
                    // onCopy={() => currentContent && handleCopy()}
                    className="border-none bg-surface4 p-2 !h-[260px]"
                  />
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full max-w-[100rem] mx-auto">
            <Txt as="h2" variant="header-md" className="mb-[2rem]">
              Scores by Agent Id
            </Txt>

            <div className="grid  border border-border1 bg-surface3 rounded-md ">
              {scorer?.agentIds.map((agentId: string) => (
                <AgentScores agentId={agentId} />
              ))}
            </div>
          </div>
        </MainContentContent>
      ) : null}
    </MainContentLayout>
  );
}

/*


      <div>
        <div>
          Sampling Type: {scorer?.sampling?.type}
          Sampling Rate: {scorer?.sampling?.type === 'ratio' ? scorer?.sampling?.rate : 'None'}
        </div>
      </div>
      <div>
        <h2>Prompts</h2>
        <ul>
          {Object.entries(scorer?.prompts || {}).map(([key, value]) => (
            <li key={key}>
              <h2>{key}</h2>
              <p>{value.prompt}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <ul>
          {scorer?.agentIds.map((agentId: string) => (
            <AgentScores agentId={agentId} />
          ))}
        </ul>
      </div>


      */
