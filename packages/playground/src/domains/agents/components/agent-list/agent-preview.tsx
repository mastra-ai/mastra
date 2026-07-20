import type { GetAgentResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { CardDescription, CardTitle } from '@mastra/playground-ui/components/Card';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { TextAndIcon } from '@mastra/playground-ui/components/Text';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { InfoIcon } from '@mastra/playground-ui/icons/InfoIcon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { useId } from 'react';
import { extractPrompt } from '../../utils/extractPrompt';
import { ProviderLogo } from '../agent-metadata/provider-logo';

export interface AgentPreviewProps {
  agent: GetAgentResponse;
}

function formatCount(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

export function AgentPreview({ agent }: AgentPreviewProps) {
  const titleId = useId();
  const instructions = extractPrompt(agent.instructions);
  const agentsCount = Object.keys(agent.agents ?? {}).length;
  const toolsCount = Object.keys(agent.tools ?? {}).length;
  const workflowsCount = Object.keys(agent.workflows ?? {}).length;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button type="button" variant="ghost" size="icon-xs" aria-label={`Preview ${agent.name}`}>
            <InfoIcon />
          </Button>
        }
      />
      <PopoverContent aria-labelledby={titleId} side="left" align="center" className="w-96 max-w-[calc(100vw-2rem)]">
        <div className="grid gap-3">
          <div className="grid gap-1">
            <CardTitle id={titleId}>{agent.name}</CardTitle>
            <TextAndIcon>
              {agent.provider ? (
                <span role="img" aria-label={`${agent.provider} provider`} className="inline-flex">
                  <ProviderLogo providerId={agent.provider} className="dark:invert" />
                </span>
              ) : null}
              <span>{agent.modelId || 'No model configured'}</span>
            </TextAndIcon>
          </div>

          <CardDescription
            aria-label={`${agent.name} instructions`}
            className="max-h-40 overflow-y-auto whitespace-pre-wrap"
            tabIndex={0}
          >
            {instructions || 'No instructions provided.'}
          </CardDescription>

          <div className="flex items-center gap-4">
            <TextAndIcon>
              <WorkflowIcon aria-hidden="true" />
              <span>{formatCount(workflowsCount, 'workflow')}</span>
            </TextAndIcon>
            <TextAndIcon>
              <AgentIcon aria-hidden="true" />
              <span>{formatCount(agentsCount, 'agent')}</span>
            </TextAndIcon>
            <TextAndIcon>
              <ToolsIcon aria-hidden="true" />
              <span>{formatCount(toolsCount, 'tool')}</span>
            </TextAndIcon>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
