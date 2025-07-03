import { Header, HeaderTitle, MainContentLayout } from '@mastra/playground-ui';
import { useParams } from 'react-router';
import { useScorer, useScoresByEntityId } from '@/hooks/use-scorers';

function AgentScores({ agentId }: { agentId: string }) {
  const { scores } = useScoresByEntityId(agentId, 'AGENT');

  console.log({ scores });

  return (
    <div>
      <h2>Scores by Agent Id</h2>
      <ul>
        {scores?.scores.map(score => (
          <li key={score.id}>{score.id}</li>
        ))}
      </ul>
    </div>
  );
}

export default function Scorer() {
  const { scorerId } = useParams();
  const { scorer, isLoading } = useScorer(scorerId!);

  console.log({ scorer, isLoading });

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>{scorer?.scorer.name}</HeaderTitle>
        <p>{scorer?.scorer.description}</p>
      </Header>

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
    </MainContentLayout>
  );
}
