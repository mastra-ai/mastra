import type { GetAgentResponse } from '@mastra/client-js';
import { DataList as EntityList, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { useRef } from 'react';
import type { SyntheticEvent } from 'react';
import { extractPrompt } from '../../utils/extractPrompt';
import { AgentProviderDetails } from './agent-provider-details';
import { AgentSubagentDetails } from './agent-subagent-details';
import { AgentToolsDetails } from './agent-tools-details';
import { AgentWorkflowDetails } from './agent-workflow-details';
import { useLinkComponent } from '@/lib/framework';

export interface AgentRowProps {
  agent: GetAgentResponse;
  rowProps: ReturnType<ReturnType<typeof useDataListKeyboard>['getRowProps']>;
}

// Trailing cells host popovers: a click there must open the popover, not
// activate the row. Same for the link itself, whose native click already
// navigates — letting it bubble to the wrapper would navigate twice.
const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

/**
 * Reference pattern for "whole row activates" on lists using
 * `useDataListKeyboard({ global: true })`: the wrapper owns focus/roving and
 * forwards activation to the inner link via `linkRef.current.click()`.
 */
export function AgentRow({ agent, rowProps }: AgentRowProps) {
  const { paths, Link } = useLinkComponent();
  const linkRef = useRef<HTMLAnchorElement>(null);

  const instructions = extractPrompt(agent.instructions).replace(/\s+/g, ' ').trim();
  const purpose = instructions || 'No instructions provided.';

  return (
    <EntityList.RowWrapper {...rowProps} onSelectRow={() => linkRef.current?.click()}>
      <EntityList.RowLink
        ref={linkRef}
        colEnd={3}
        to={paths.agentNewThreadLink(agent.id)}
        LinkComponent={Link}
        tabIndex={-1}
        onClick={stopPropagation}
      >
        <EntityList.Cell className="text-neutral4 min-w-0 overflow-visible text-left">
          <span title={agent.name} className="block max-w-full min-w-0 overflow-clip text-ellipsis whitespace-nowrap">
            {agent.name}
          </span>
        </EntityList.Cell>
        <EntityList.Cell className="min-w-0 overflow-visible">
          <span title={purpose} className="block max-w-full min-w-0 overflow-clip text-ellipsis whitespace-nowrap">
            {purpose}
          </span>
        </EntityList.Cell>
      </EntityList.RowLink>
      <EntityList.Cell className="justify-center overflow-visible" onClick={stopPropagation}>
        <AgentProviderDetails agentName={agent.name} provider={agent.provider} modelId={agent.modelId} />
      </EntityList.Cell>
      <EntityList.Cell className="justify-center overflow-visible" onClick={stopPropagation}>
        <AgentWorkflowDetails agentName={agent.name} workflows={agent.workflows} />
      </EntityList.Cell>
      <EntityList.Cell className="justify-center overflow-visible" onClick={stopPropagation}>
        <AgentSubagentDetails agentName={agent.name} agents={agent.agents} />
      </EntityList.Cell>
      <EntityList.Cell className="justify-center overflow-visible" onClick={stopPropagation}>
        <AgentToolsDetails agentName={agent.name} tools={agent.tools} />
      </EntityList.Cell>
    </EntityList.RowWrapper>
  );
}
