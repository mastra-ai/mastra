import type { GetAgentResponse } from '@mastra/client-js';
import {
  DataList as EntityList,
  DataListSkeleton as EntityListSkeleton,
} from '@mastra/playground-ui/components/DataList';
import { TextAndIcon } from '@mastra/playground-ui/components/Text';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { extractPrompt } from '../../utils/extractPrompt';
import { AgentProviderDetails } from './agent-provider-details';
import { AgentSubagentDetails } from './agent-subagent-details';
import { AgentToolsDetails } from './agent-tools-details';
import { AgentWorkflowDetails } from './agent-workflow-details';
import { useLinkComponent } from '@/lib/framework';

export interface AgentsListProps {
  agents: GetAgentResponse[];
  isLoading: boolean;
  hasSearch: boolean;
}

const agentsListColumns = 'minmax(12rem,20rem) minmax(16rem,30rem) auto auto auto auto';

export function AgentsList({ agents, isLoading, hasSearch }: AgentsListProps) {
  const { paths, Link } = useLinkComponent();

  if (isLoading) {
    return <EntityListSkeleton columns={agentsListColumns} />;
  }

  return (
    <EntityList columns={agentsListColumns}>
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Purpose</EntityList.TopCell>
        <EntityList.TopCell className="text-center">Provider</EntityList.TopCell>
        <EntityList.TopCell className="text-center">
          <TextAndIcon className="justify-center">
            <WorkflowIcon aria-hidden="true" />
            <span>Workflows</span>
          </TextAndIcon>
        </EntityList.TopCell>
        <EntityList.TopCell className="text-center">
          <TextAndIcon className="justify-center">
            <AgentIcon aria-hidden="true" />
            <span>Agents</span>
          </TextAndIcon>
        </EntityList.TopCell>
        <EntityList.TopCell className="text-center">
          <TextAndIcon className="justify-center">
            <ToolsIcon aria-hidden="true" />
            <span>Tools</span>
          </TextAndIcon>
        </EntityList.TopCell>
      </EntityList.Top>

      {agents.length === 0 && hasSearch ? <EntityList.NoMatch message="No Agents match your search" /> : null}

      {agents.map(agent => {
        const instructions = extractPrompt(agent.instructions).replace(/\s+/g, ' ').trim();
        const purpose = instructions || 'No instructions provided.';

        return (
          <EntityList.RowWrapper key={agent.id}>
            <EntityList.RowLink colEnd={3} to={paths.agentLink(agent.id)} LinkComponent={Link}>
              <EntityList.Cell className="text-neutral4 min-w-0 overflow-visible text-left">
                <span
                  title={agent.name}
                  className="block max-w-full min-w-0 overflow-clip text-ellipsis whitespace-nowrap"
                >
                  {agent.name}
                </span>
              </EntityList.Cell>
              <EntityList.Cell className="min-w-0 overflow-visible">
                <span
                  title={purpose}
                  className="block max-w-full min-w-0 overflow-clip text-ellipsis whitespace-nowrap"
                >
                  {purpose}
                </span>
              </EntityList.Cell>
            </EntityList.RowLink>
            <EntityList.Cell className="justify-center overflow-visible py-0">
              <AgentProviderDetails agentName={agent.name} provider={agent.provider} modelId={agent.modelId} />
            </EntityList.Cell>
            <EntityList.Cell className="justify-center overflow-visible py-0">
              <AgentWorkflowDetails agentName={agent.name} workflows={agent.workflows} />
            </EntityList.Cell>
            <EntityList.Cell className="justify-center overflow-visible py-0">
              <AgentSubagentDetails agentName={agent.name} agents={agent.agents} />
            </EntityList.Cell>
            <EntityList.Cell className="justify-center overflow-visible py-0">
              <AgentToolsDetails agentName={agent.name} tools={agent.tools} />
            </EntityList.Cell>
          </EntityList.RowWrapper>
        );
      })}
    </EntityList>
  );
}
