import type { GetAgentResponse } from '@mastra/client-js';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { MemoryIcon } from '@mastra/playground-ui/icons/MemoryIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Bot, ChevronRight, ExternalLink, Pencil, SlidersHorizontal, WorkflowIcon, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { useAgent } from '@/domains/agents/hooks/use-agent';
import { useAgentVersions } from '@/domains/agents/hooks/use-agent-versions';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useMemory } from '@/domains/memory/hooks/use-memory';

type CapabilityTone = 'purple' | 'amber' | 'emerald' | 'sky' | 'cyan' | 'orange';

type Capability = {
  id: string;
  label: string;
  status: string;
  description: string;
  docsHref: string;
  enabled: boolean;
  tone: CapabilityTone;
  icon: ReactNode;
};

type CapabilityCollection =
  | NonNullable<GetAgentResponse['tools']>
  | NonNullable<GetAgentResponse['workflows']>
  | NonNullable<GetAgentResponse['agents']>;

const toneClassName: Record<CapabilityTone, { icon: string }> = {
  purple: {
    icon: 'text-purple-700 dark:text-purple-300',
  },
  amber: {
    icon: 'text-amber-700 dark:text-amber-300',
  },
  emerald: {
    icon: 'text-emerald-700 dark:text-emerald-300',
  },
  sky: {
    icon: 'text-sky-700 dark:text-sky-300',
  },
  cyan: {
    icon: 'text-cyan-700 dark:text-cyan-300',
  },
  orange: {
    icon: 'text-orange-700 dark:text-orange-300',
  },
};

const getRecordCount = (value?: CapabilityCollection) => {
  return value ? Object.keys(value).length : 0;
};

const countStatus = (count: number) => (count > 0 ? String(count) : 'Off');

function getMemoryStatus(isLoading: boolean, hasMemory: boolean, memoryType?: 'local' | 'gateway'): string {
  if (isLoading) return 'Checking';
  if (!hasMemory) return 'Off';
  return memoryType === 'gateway' ? 'Gateway' : 'On';
}

function getEditorStatus(isLoading: boolean, enabled: boolean, locked: boolean, versionCount: number): string {
  if (isLoading) return 'Checking';
  if (enabled) return versionCount > 0 ? String(versionCount) : 'Ready';
  return locked ? 'Locked' : 'Off';
}

function getEditorDescription(enabled: boolean, locked: boolean): string {
  if (enabled) return 'Editor is available for versioned agent overrides.';
  if (locked) return 'This code-defined agent explicitly disables editor overrides.';
  return 'Register MastraEditor to enable versioned agent overrides.';
}

function CapabilityIconChip({ capability }: { capability: Capability }) {
  const tone = toneClassName[capability.tone];

  return (
    <span
      aria-label={`${capability.label}: ${capability.status}`}
      className={cn(
        'pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-neutral3',
        capability.enabled ? tone.icon : undefined,
      )}
    >
      <span className="size-3 shrink-0 [&>svg]:size-3">{capability.icon}</span>
    </span>
  );
}

function CapabilityDetailRow({ capability }: { capability: Capability }) {
  const tone = toneClassName[capability.tone];

  return (
    <a
      aria-label={`${capability.label}: ${capability.status}`}
      href={capability.docsHref}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group/capability-row flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-ui-xs text-neutral4 transition-colors duration-normal',
        'hover:bg-surface4/60 hover:text-neutral6 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border2',
      )}
    >
      <span
        className={cn(
          'mt-0.5 size-3.5 shrink-0 text-neutral3 transition-colors duration-normal [&>svg]:size-3.5',
          capability.enabled ? tone.icon : 'group-hover/capability-row:text-neutral5',
        )}
      >
        {capability.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate font-medium text-neutral5">{capability.label}</span>
          <span className="shrink-0 tabular-nums text-neutral3">{capability.status}</span>
        </span>
        <span className="mt-0.5 block text-neutral3 transition-colors duration-normal group-hover/capability-row:text-neutral4">
          {capability.description}
        </span>
      </span>
      <ExternalLink className="mt-0.5 size-3 shrink-0 text-neutral3 transition-colors duration-normal group-hover/capability-row:text-neutral5" />
    </a>
  );
}

export function AgentCapabilitiesFooter({ agentId }: { agentId: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Derive memory state from the shared (React Query deduped) hook instead of
  // accepting it as props — see structure-derive-dont-duplicate.
  const { data: memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const hasMemory = Boolean(memory?.result);
  const memoryType = memory?.memoryType;
  const { data: agent, isLoading: isAgentLoading } = useAgent(agentId);
  const { isCmsAvailable, isLoading: isCmsAvailabilityLoading } = useIsCmsAvailable();
  const editorEnabled = Boolean(!isCmsAvailabilityLoading && isCmsAvailable && agent && agent.editor !== false);
  const editorLocked = agent?.editor === false;
  const versionsQuery = useAgentVersions({
    agentId,
    params: { orderBy: { field: 'createdAt', direction: 'DESC' } },
    enabled: editorEnabled,
  });

  const versionCount = versionsQuery.data?.total ?? versionsQuery.data?.versions.length ?? 0;
  const toolsCount = getRecordCount(agent?.tools);
  const workflowsCount = getRecordCount(agent?.workflows);
  const subAgentsCount = getRecordCount(agent?.agents);
  const processorsCount = (agent?.inputProcessors?.length ?? 0) + (agent?.outputProcessors?.length ?? 0);
  const isEditorLoading = isAgentLoading || isCmsAvailabilityLoading || (editorEnabled && versionsQuery.isLoading);
  const isAgentCapabilitiesLoading = isAgentLoading && !agent;

  const capabilities: Capability[] = [
    {
      id: 'memory',
      label: 'Memory',
      status: getMemoryStatus(isMemoryLoading, hasMemory, memoryType),
      description: hasMemory
        ? 'Conversation history and configured memory features are available for this agent.'
        : 'This agent has no memory configured, so conversations are not saved as memory-backed threads.',
      docsHref: 'https://mastra.ai/docs/memory/overview',
      enabled: hasMemory,
      tone: 'purple',
      icon: <MemoryIcon />,
    },
    {
      id: 'editor',
      label: 'Editor',
      status: getEditorStatus(isEditorLoading, editorEnabled, editorLocked, versionCount),
      description: getEditorDescription(editorEnabled, editorLocked),
      docsHref: 'https://mastra.ai/docs/editor/overview',
      enabled: editorEnabled,
      tone: 'amber',
      icon: <Pencil />,
    },
    {
      id: 'tools',
      label: 'Tools',
      status: isAgentCapabilitiesLoading ? 'Checking' : countStatus(toolsCount),
      description:
        toolsCount > 0 ? `${toolsCount} tool${toolsCount === 1 ? '' : 's'} available.` : 'No tools are configured.',
      docsHref: 'https://mastra.ai/docs/agents/using-tools-and-mcp',
      enabled: toolsCount > 0,
      tone: 'emerald',
      icon: <Wrench />,
    },
    {
      id: 'workflows',
      label: 'Workflows',
      status: isAgentCapabilitiesLoading ? 'Checking' : countStatus(workflowsCount),
      description:
        workflowsCount > 0
          ? `${workflowsCount} workflow${workflowsCount === 1 ? '' : 's'} available.`
          : 'No workflows are attached to this agent.',
      docsHref: 'https://mastra.ai/docs/workflows/overview',
      enabled: workflowsCount > 0,
      tone: 'sky',
      icon: <WorkflowIcon />,
    },
    {
      id: 'sub-agents',
      label: 'Sub-agents',
      status: isAgentCapabilitiesLoading ? 'Checking' : countStatus(subAgentsCount),
      description:
        subAgentsCount > 0
          ? `${subAgentsCount} sub-agent${subAgentsCount === 1 ? '' : 's'} available.`
          : 'No sub-agents are attached to this agent.',
      docsHref: 'https://mastra.ai/docs/agents/supervisor-agents',
      enabled: subAgentsCount > 0,
      tone: 'cyan',
      icon: <Bot />,
    },
    {
      id: 'processors',
      label: 'Processors',
      status: isAgentCapabilitiesLoading ? 'Checking' : countStatus(processorsCount),
      description:
        processorsCount > 0
          ? `${processorsCount} input/output processor${processorsCount === 1 ? '' : 's'} configured.`
          : 'No input or output processors are configured.',
      docsHref: 'https://mastra.ai/docs/agents/processors',
      enabled: processorsCount > 0,
      tone: 'orange',
      icon: <SlidersHorizontal />,
    },
  ];

  const enabledCount = capabilities.filter(capability => capability.enabled).length;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="shrink-0 border-t border-border1/50">
        <CollapsibleTrigger asChild aria-label={isExpanded ? 'Hide capability details' : 'Show capability details'}>
          <button
            type="button"
            data-testid="agent-capabilities-footer"
            className="flex w-full cursor-pointer items-center gap-1.5 px-2 py-2 text-left text-neutral4 transition-colors duration-normal hover:!text-neutral4 hover:bg-surface4 focus-visible:!text-neutral4 focus-visible:bg-surface4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border2 active:bg-surface5/80 aria-expanded:bg-surface4/70 data-[panel-open]:bg-surface4/70"
          >
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
              {capabilities.map(capability => (
                <CapabilityIconChip key={capability.id} capability={capability} />
              ))}
            </div>
            <Txt as="span" variant="ui-xs" className="shrink-0 text-neutral3">
              {enabledCount}/{capabilities.length}
            </Txt>
            <ChevronRight
              className={cn(
                'size-3.5 shrink-0 text-neutral3 transition-transform duration-normal ease-out-custom',
                isExpanded ? 'rotate-90' : undefined,
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="px-2 pb-2">
          <div className="grid gap-1">
            {capabilities.map(capability => (
              <CapabilityDetailRow key={capability.id} capability={capability} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
