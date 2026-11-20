import type { GetAgentResponse } from '@mastra/client-js';
import { useId } from 'react';
import { extractPrompt } from '../extract-prompt';
import type { AgentCapability } from './agent-capabilities';
import { AgentProviderDetails } from './agent-provider-details';
import { AgentSubagentDetails } from './agent-subagent-details';
import { AgentToolsDetails } from './agent-tools-details';
import { AgentWorkflowDetails } from './agent-workflow-details';
import { CardContent, CardDescription, CardLink, CardTitle } from '@/ds/components/Card';
import { useLinkComponent } from '@/lib/framework';

export interface AgentCompactCardProps {
  agent: GetAgentResponse;
  capabilities: readonly AgentCapability[];
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

export function AgentCompactCard({ agent, capabilities }: AgentCompactCardProps) {
  const { paths, Link } = useLinkComponent();
  const accessibleId = useId();
  const instructions = extractPrompt(agent.instructions).replace(/\s+/g, ' ').trim();
  const instructionPreview = getInstructionPreview(instructions);
  const showWorkflows = capabilities.includes('workflows');
  const showAgents = capabilities.includes('agents');
  const showTools = capabilities.includes('tools');
  const agentsCount = showAgents ? Object.keys(agent.agents ?? {}).length : 0;
  const toolsCount = showTools ? Object.keys(agent.tools ?? {}).length : 0;
  const workflowsCount = showWorkflows ? Object.keys(agent.workflows ?? {}).length : 0;
  const capabilitiesCount = agentsCount + toolsCount + workflowsCount;

  return (
    <div className="group/agent relative h-full min-w-0">
      <CardLink
        LinkComponent={Link}
        href={paths.agentLink(agent.id)}
        aria-label={`Open ${agent.name}`}
        aria-describedby={`${accessibleId}-instructions ${accessibleId}-metadata`}
        className="absolute inset-0 group-focus-within/agent:bg-fill-subtle group-hover/agent:bg-fill-subtle"
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
          {[
            showWorkflows && formatCount(workflowsCount, 'workflow'),
            showAgents && formatCount(agentsCount, 'agent'),
            showTools && formatCount(toolsCount, 'tool'),
          ]
            .filter(Boolean)
            .join(', ')}
          .
        </span>

        <div className="flex min-w-0 items-center justify-between gap-4">
          <CardDescription className="min-w-0">
            <AgentProviderDetails agentName={agent.name} provider={agent.provider} modelId={agent.modelId} />
          </CardDescription>

          <CardDescription className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {showWorkflows ? <AgentWorkflowDetails agentName={agent.name} workflows={agent.workflows} /> : null}
            {showAgents ? <AgentSubagentDetails agentName={agent.name} agents={agent.agents} /> : null}
            {showTools ? <AgentToolsDetails agentName={agent.name} tools={agent.tools} /> : null}
            {capabilitiesCount === 0 ? <span>—</span> : null}
          </CardDescription>
        </div>
      </CardContent>
    </div>
  );
}
