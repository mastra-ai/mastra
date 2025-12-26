import {
  Button,
  DocsIcon,
  HeaderAction,
  Icon,
  MainContentContent,
  Header,
  HeaderTitle,
  MainContentLayout,
  useAgents,
  useScorers,
  TrainingPage,
  useStudioConfig,
} from '@mastra/playground-ui';
import { GraduationCapIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';

export default function Training() {
  const { baseUrl } = useStudioConfig();
  const { jobId } = useParams<{ jobId?: string }>();
  const { data: agentsMap = {}, isLoading: agentsLoading } = useAgents();
  const { data: scorersMap = {}, isLoading: scorersLoading } = useScorers();

  const isLoading = agentsLoading || scorersLoading;

  // Convert maps to arrays for the TrainingPage component
  const agents = Object.entries(agentsMap).map(([id, agent]) => ({
    id,
    name: (agent as { name?: string }).name || id,
  }));

  const scorers = Object.entries(scorersMap).map(([id, scorer]) => ({
    id,
    name: (scorer as { name?: string }).name || id,
  }));

  if (isLoading) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <GraduationCapIcon />
            </Icon>
            Training
          </HeaderTitle>
        </Header>
        <MainContentContent isCentered>
          <div className="flex items-center justify-center">
            <div className="animate-pulse text-gray-500">Loading...</div>
          </div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

  return <TrainingPage baseUrl={baseUrl} agents={agents} scorers={scorers} jobId={jobId} />;
}
