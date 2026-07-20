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
import { ProviderLogo } from '../agent-metadata/provider-logo';
import { AgentPreview } from './agent-preview';
import { useLinkComponent } from '@/lib/framework';

export interface AgentsListProps {
  agents: GetAgentResponse[];
  isLoading: boolean;
  hasSearch: boolean;
}

const agentsListColumns = 'minmax(12rem,20rem) minmax(16rem,30rem) auto auto auto auto auto';

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
        <EntityList.TopCell>
          <span className="sr-only">Preview</span>
        </EntityList.TopCell>
      </EntityList.Top>

      {agents.length === 0 && hasSearch ? <EntityList.NoMatch message="No Agents match your search" /> : null}

      {agents.map(agent => {
        const instructions = extractPrompt(agent.instructions).replace(/\s+/g, ' ').trim();
        const purpose = instructions || 'No instructions provided.';
        const agentsCount = Object.keys(agent.agents ?? {}).length;
        const toolsCount = Object.keys(agent.tools ?? {}).length;
        const workflowsCount = Object.keys(agent.workflows ?? {}).length;

        return (
          <EntityList.RowWrapper key={agent.id}>
            <EntityList.RowLink colEnd={-2} to={paths.agentLink(agent.id)} LinkComponent={Link}>
              <EntityList.Cell className="min-w-0 overflow-visible text-left text-neutral4">
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
              <EntityList.Cell className="overflow-visible justify-center">
                {agent.provider ? (
                  <span
                    role="img"
                    aria-label={`${agent.provider} provider`}
                    title={agent.provider}
                    className="inline-flex items-center justify-center"
                  >
                    <TextAndIcon aria-hidden="true">
                      <ProviderLogo providerId={agent.provider} className="dark:invert" />
                    </TextAndIcon>
                  </span>
                ) : null}
              </EntityList.Cell>
              <EntityList.Cell className="overflow-visible text-center">{workflowsCount || ''}</EntityList.Cell>
              <EntityList.Cell className="overflow-visible text-center">{agentsCount || ''}</EntityList.Cell>
              <EntityList.Cell className="overflow-visible text-center">{toolsCount || ''}</EntityList.Cell>
            </EntityList.RowLink>
            <EntityList.Cell className="overflow-visible justify-center py-0">
              <AgentPreview agent={agent} />
            </EntityList.Cell>
          </EntityList.RowWrapper>
        );
      })}
    </EntityList>
  );
}
