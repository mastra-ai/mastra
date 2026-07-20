import type { GetAgentResponse } from '@mastra/client-js';
import { CardContent, CardDescription, CardLink, CardTitle } from '@mastra/playground-ui/components/Card';
import { TextAndIcon } from '@mastra/playground-ui/components/Text';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { useId } from 'react';
import { extractPrompt } from '../../utils/extractPrompt';
import { ProviderLogo } from '../agent-metadata/provider-logo';
import { useLinkComponent } from '@/lib/framework';

export interface AgentCompactCardProps {
  agent: GetAgentResponse;
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function truncateGraphemes(value: string, maxLength: number) {
  let count = 0;
  for (const { index } of graphemeSegmenter.segment(value)) {
    if (count === maxLength) return value.slice(0, index);
    count++;
  }
  return value;
}

const instructionPreviewLength = 80;

function getInstructionPreview(instructions: string) {
  if (!instructions) return 'No instructions provided.';

  const firstSentenceEnd = instructions.search(/[.!?](?:\s|$)/);
  const firstSentence = firstSentenceEnd === -1 ? instructions : instructions.slice(0, firstSentenceEnd + 1);

  const preview = truncateGraphemes(firstSentence, instructionPreviewLength);
  if (preview === firstSentence) return firstSentence;

  const lastWordEnd = preview.lastIndexOf(' ');
  const previewEnd = lastWordEnd > 0 ? lastWordEnd : preview.length;
  return `${preview.slice(0, previewEnd)}…`;
}

function formatCount(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

export function AgentCompactCard({ agent }: AgentCompactCardProps) {
  const { paths, Link } = useLinkComponent();
  const accessibleId = useId();
  const instructions = extractPrompt(agent.instructions).replace(/\s+/g, ' ').trim();
  const instructionPreview = getInstructionPreview(instructions);
  const agentsCount = Object.keys(agent.agents ?? {}).length;
  const toolsCount = Object.keys(agent.tools ?? {}).length;
  const workflowsCount = Object.keys(agent.workflows ?? {}).length;
  const capabilitiesCount = agentsCount + toolsCount + workflowsCount;

  return (
    <CardLink
      LinkComponent={Link}
      href={paths.agentLink(agent.id)}
      appearance="surface"
      aria-label={`Open ${agent.name}`}
      aria-describedby={`${accessibleId}-instructions ${accessibleId}-metadata`}
      className="group/agent flex h-full min-w-0 flex-col"
    >
      <CardContent density="compact" className="grid h-full min-w-0 gap-2">
        <CardTitle title={agent.name} className="max-w-full min-w-0 overflow-clip text-ellipsis whitespace-nowrap">
          {agent.name}
        </CardTitle>

        <CardDescription
          id={`${accessibleId}-instructions`}
          title={instructions || instructionPreview}
          className="min-w-0 overflow-clip text-ellipsis whitespace-nowrap"
        >
          {instructionPreview}
        </CardDescription>

        <span id={`${accessibleId}-metadata`} className="sr-only">
          {agent.provider ? `${agent.provider} provider. ` : 'No provider configured. '}
          {formatCount(workflowsCount, 'workflow')}, {formatCount(agentsCount, 'agent')},{' '}
          {formatCount(toolsCount, 'tool')}.
        </span>

        <div aria-hidden="true" className="grid min-w-0">
          <div className="col-start-1 row-start-1 grid min-w-0 translate-y-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 opacity-100 motion-safe:transition-[opacity,translate] motion-safe:duration-normal motion-safe:ease-out-custom motion-safe:group-focus-visible/agent:-translate-y-1 motion-safe:group-hover/agent:-translate-y-1 group-focus-visible/agent:opacity-0 group-hover/agent:opacity-0">
            <CardDescription className="min-w-0">
              {agent.provider ? (
                <TextAndIcon>
                  <ProviderLogo providerId={agent.provider} className="dark:invert" />
                </TextAndIcon>
              ) : (
                '—'
              )}
            </CardDescription>

            <CardDescription className="flex items-center justify-end gap-2 whitespace-nowrap">
              {workflowsCount > 0 ? (
                <TextAndIcon>
                  <WorkflowIcon />
                  <span>{workflowsCount}</span>
                </TextAndIcon>
              ) : null}
              {agentsCount > 0 ? (
                <TextAndIcon>
                  <AgentIcon />
                  <span>{agentsCount}</span>
                </TextAndIcon>
              ) : null}
              {toolsCount > 0 ? (
                <TextAndIcon>
                  <ToolsIcon />
                  <span>{toolsCount}</span>
                </TextAndIcon>
              ) : null}
              {capabilitiesCount === 0 ? <span>—</span> : null}
            </CardDescription>
          </div>

          <div className="pointer-events-none col-start-1 row-start-1 grid min-w-0 translate-y-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 opacity-0 motion-safe:translate-y-1 motion-safe:transition-[opacity,translate] motion-safe:duration-normal motion-safe:ease-out-custom motion-safe:group-focus-visible/agent:translate-y-0 motion-safe:group-hover/agent:translate-y-0 group-focus-visible/agent:opacity-100 group-hover/agent:opacity-100">
            <CardDescription className="min-w-0">
              <TextAndIcon className="min-w-0">
                {agent.provider ? <ProviderLogo providerId={agent.provider} className="dark:invert" /> : null}
                <span className="min-w-0 overflow-clip text-ellipsis whitespace-nowrap">
                  {agent.provider || 'No provider'}
                </span>
              </TextAndIcon>
            </CardDescription>

            <CardDescription className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {workflowsCount > 0 ? (
                <TextAndIcon>
                  <WorkflowIcon />
                  <span>{formatCount(workflowsCount, 'workflow')}</span>
                </TextAndIcon>
              ) : null}
              {agentsCount > 0 ? (
                <TextAndIcon>
                  <AgentIcon />
                  <span>{formatCount(agentsCount, 'agent')}</span>
                </TextAndIcon>
              ) : null}
              {toolsCount > 0 ? (
                <TextAndIcon>
                  <ToolsIcon />
                  <span>{formatCount(toolsCount, 'tool')}</span>
                </TextAndIcon>
              ) : null}
              {capabilitiesCount === 0 ? <span>No capabilities</span> : null}
            </CardDescription>
          </div>
        </div>
      </CardContent>
    </CardLink>
  );
}
