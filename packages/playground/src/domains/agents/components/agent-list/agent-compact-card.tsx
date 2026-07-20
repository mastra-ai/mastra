import type { GetAgentResponse } from '@mastra/client-js';
import { CardContent, CardDescription, CardLink, CardTitle } from '@mastra/playground-ui/components/Card';
import { useId } from 'react';
import { extractPrompt } from '../../utils/extractPrompt';
import { AgentProviderDetails } from './agent-provider-details';
import { AgentSubagentDetails } from './agent-subagent-details';
import { AgentToolsDetails } from './agent-tools-details';
import { AgentWorkflowDetails } from './agent-workflow-details';
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
    <div className="group/agent relative h-full min-w-0">
      <CardLink
        LinkComponent={Link}
        href={paths.agentLink(agent.id)}
        appearance="surface"
        aria-label={`Open ${agent.name}`}
        aria-describedby={`${accessibleId}-instructions ${accessibleId}-metadata`}
        className="absolute inset-0 group-focus-within/agent:bg-surface4 group-hover/agent:bg-surface4"
      >
        <span className="sr-only">Open {agent.name}</span>
      </CardLink>

      <CardContent density="compact" className="pointer-events-none relative grid h-full min-w-0 gap-2">
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

        <div className="flex min-w-0 items-center justify-between gap-4">
          <CardDescription className="min-w-0">
            <AgentProviderDetails agentName={agent.name} provider={agent.provider} modelId={agent.modelId} />
          </CardDescription>

          <CardDescription className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <AgentWorkflowDetails agentName={agent.name} workflows={agent.workflows} />
            <AgentSubagentDetails agentName={agent.name} agents={agent.agents} />
            <AgentToolsDetails agentName={agent.name} tools={agent.tools} />
            {capabilitiesCount === 0 ? <span>—</span> : null}
          </CardDescription>
        </div>
      </CardContent>
    </div>
  );
}
