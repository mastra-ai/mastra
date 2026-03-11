import {
  Button,
  useAgents,
  AgentList,
  AgentIcon,
  useIsCmsAvailable,
  usePermissions,
  useLinkComponent,
  PageContent,
  MainHeader,
} from '@mastra/playground-ui';
import { ExternalLinkIcon, Plus } from 'lucide-react';
import { Link } from 'react-router';

function Agents() {
  const { navigate } = useLinkComponent();
  const { data: agents = {}, isLoading, error } = useAgents();
  const { isCmsAvailable } = useIsCmsAvailable();
  const { canEdit } = usePermissions();

  const canCreateAgent = isCmsAvailable && canEdit('stored-agents');

  const handleCreateClick = () => {
    navigate('/cms/agents/create');
  };

  return (
    <PageContent>
      <PageContent.TopBar>
        <Button as={Link} to="https://mastra.ai/en/docs/agents/overview" target="_blank" variant="ghost" size="md">
          Agents Documentation
          <ExternalLinkIcon />
        </Button>
      </PageContent.TopBar>
      <PageContent.Main>
        <div className="w-full max-w-[90rem] px-10 mx-auto grid h-full grid-rows-[auto_1fr] overflow-y-auto">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title isLoading={isLoading}>
                <AgentIcon /> Agents
              </MainHeader.Title>
            </MainHeader.Column>
            {canCreateAgent && (
              <MainHeader.Column>
                <Button as={Link} to="/cms/agents/create" variant="primary">
                  <Plus />
                  Create Agent
                </Button>
              </MainHeader.Column>
            )}
          </MainHeader>

          <AgentList
            agents={agents}
            isLoading={isLoading}
            error={error}
            onCreateClick={canCreateAgent ? handleCreateClick : undefined}
          />
        </div>
      </PageContent.Main>
    </PageContent>
  );
}

export { Agents };

export default Agents;
