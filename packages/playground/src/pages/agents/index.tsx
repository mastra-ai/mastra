import {
  ButtonWithTooltip,
  useAgents,
  AgentsList,
  AgentIcon,
  ListSearch,
  MainHeader,
  EntityListPageLayout,
  useCanCreateAgent,
  useLinkComponent,
} from '@mastra/playground-ui';
import { BookIcon, Plus } from 'lucide-react';
import { useState } from 'react';

function Agents() {
  const { data: agents = {}, isLoading, error } = useAgents();
  const [search, setSearch] = useState('');
  const { canCreateAgent } = useCanCreateAgent();
  const { Link: FrameworkLink, paths } = useLinkComponent();
  const createAgentPath = paths.cmsAgentCreateLink();
  const showCreateCta = canCreateAgent && Boolean(createAgentPath);

  return (
    <EntityListPageLayout>
      <EntityListPageLayout.Top>
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title isLoading={isLoading}>
              <AgentIcon /> Agents
            </MainHeader.Title>
          </MainHeader.Column>
          <MainHeader.Column className="flex justify-end gap-2">
            {showCreateCta && (
              <ButtonWithTooltip as={FrameworkLink} to={createAgentPath} tooltipContent="Create an agent">
                <Plus />
              </ButtonWithTooltip>
            )}
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/agents/overview"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Agents documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </MainHeader.Column>
        </MainHeader>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter agents" placeholder="Filter by name or instructions" />
        </div>
      </EntityListPageLayout.Top>

      <AgentsList agents={agents} isLoading={isLoading} error={error} search={search} />
    </EntityListPageLayout>
  );
}

export { Agents };

export default Agents;
