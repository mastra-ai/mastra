import { MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { useSearchParams } from 'react-router';
import { agentEvalsLink } from '@/domains/agents/agent-evals-link';
import { ScorerCreateContent } from '@/domains/scores/components/scorer-create-content';
import { useLinkComponent } from '@/lib/framework';

function CmsScorersCreatePage() {
  const { navigate, paths } = useLinkComponent();
  const [searchParams] = useSearchParams();
  // Set when coming from an agent's Evals > Scorers tab: go back there and attach the new scorer.
  const agentId = searchParams.get('agentId');

  return (
    <MainContentLayout className="grid-rows-[1fr]">
      <ScorerCreateContent
        onSuccess={scorer =>
          navigate(
            agentId ? agentEvalsLink(agentId, 'scorers', { attachScorer: scorer.id }) : paths.scorerLink(scorer.id),
          )
        }
      />
    </MainContentLayout>
  );
}

export { CmsScorersCreatePage };

export default CmsScorersCreatePage;
