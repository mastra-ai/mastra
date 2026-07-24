import type { GetAgentResponse, GetMemoryStatusResponse } from '@mastra/client-js';
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

// Shared derivations over the (React Query deduped) agent/memory data, so the
// per-capability components and the summary count cannot drift apart.
const getRecordCount = (value?: CapabilityCollection) => {
  return value ? Object.keys(value).length : 0;
};

const countStatus = (count: number) => (count > 0 ? String(count) : 'Off');

const getProcessorCount = (agent: GetAgentResponse | null | undefined) =>
  (agent?.inputProcessors?.length ?? 0) + (agent?.outputProcessors?.length ?? 0);

const hasConfiguredMemory = (memory: GetMemoryStatusResponse | null | undefined) => Boolean(memory?.result);

// isCmsAvailable is false while its query loads, so no extra loading flag is needed here.
const isEditorAvailable = (agent: GetAgentResponse | null | undefined, isCmsAvailable: boolean) =>
  Boolean(isCmsAvailable && agent && agent.editor !== false);

type CapabilityView = 'chip' | 'row';

type AgentCapabilityProps = {
  agentId: string;
  view: CapabilityView;
};

type CapabilityItemProps = {
  view: CapabilityView;
  label: string;
  status: string;
  description: string;
  docsHref: string;
  enabled: boolean;
  tone: CapabilityTone;
  icon: ReactNode;
};

function CapabilityItem({ view, label, status, description, docsHref, enabled, tone, icon }: CapabilityItemProps) {
  const toneIcon = toneClassName[tone].icon;

  if (view === 'chip') {
    return (
      <span
        aria-label={`${label}: ${status}`}
        className={cn(
          'pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-neutral3',
          enabled ? toneIcon : undefined,
        )}
      >
        <span className="size-3 shrink-0 [&>svg]:size-3">{icon}</span>
      </span>
    );
  }

  return (
    <a
      aria-label={`${label}: ${status}`}
      href={docsHref}
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
          enabled ? toneIcon : 'group-hover/capability-row:text-neutral5',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate font-medium text-neutral5">{label}</span>
          <span className="shrink-0 tabular-nums text-neutral3">{status}</span>
        </span>
        <span className="mt-0.5 block text-neutral3 transition-colors duration-normal group-hover/capability-row:text-neutral4">
          {description}
        </span>
      </span>
      <ExternalLink className="mt-0.5 size-3 shrink-0 text-neutral3 transition-colors duration-normal group-hover/capability-row:text-neutral5" />
    </a>
  );
}

// Each capability component owns its data and loading state; React Query
// dedupes the underlying requests across instances — see client-request-dedupe.
function MemoryCapability({ agentId, view }: AgentCapabilityProps) {
  const { data: memory, isLoading } = useMemory(agentId);
  const enabled = hasConfiguredMemory(memory);

  const settledStatus = enabled ? (memory?.memoryType === 'gateway' ? 'Gateway' : 'On') : 'Off';
  const status = isLoading ? 'Checking' : settledStatus;

  return (
    <CapabilityItem
      view={view}
      label="Memory"
      status={status}
      description={
        enabled
          ? 'Conversation history and configured memory features are available for this agent.'
          : 'This agent has no memory configured, so conversations are not saved as memory-backed threads.'
      }
      docsHref="https://mastra.ai/docs/memory/overview"
      enabled={enabled}
      tone="purple"
      icon={<MemoryIcon />}
    />
  );
}

function EditorCapability({ agentId, view }: AgentCapabilityProps) {
  const { data: agent, isLoading: isAgentLoading } = useAgent(agentId);
  const { isCmsAvailable, isLoading: isCmsAvailabilityLoading } = useIsCmsAvailable();
  const enabled = isEditorAvailable(agent, isCmsAvailable);
  const locked = agent?.editor === false;
  const versionsQuery = useAgentVersions({
    agentId,
    params: { orderBy: { field: 'createdAt', direction: 'DESC' } },
    enabled,
  });
  const versionCount = versionsQuery.data?.total ?? versionsQuery.data?.versions.length ?? 0;
  const isLoading = isAgentLoading || isCmsAvailabilityLoading || (enabled && versionsQuery.isLoading);

  const availableStatus = versionCount > 0 ? String(versionCount) : 'Ready';
  const settledStatus = enabled ? availableStatus : locked ? 'Locked' : 'Off';
  const status = isLoading ? 'Checking' : settledStatus;

  const disabledDescription = locked
    ? 'This code-defined agent explicitly disables editor overrides.'
    : 'Register MastraEditor to enable versioned agent overrides.';
  const description = enabled ? 'Editor is available for versioned agent overrides.' : disabledDescription;

  return (
    <CapabilityItem
      view={view}
      label="Editor"
      status={status}
      description={description}
      docsHref="https://mastra.ai/docs/editor/overview"
      enabled={enabled}
      tone="amber"
      icon={<Pencil />}
    />
  );
}

function ToolsCapability({ agentId, view }: AgentCapabilityProps) {
  const { data: agent, isLoading } = useAgent(agentId);
  const count = getRecordCount(agent?.tools);

  return (
    <CapabilityItem
      view={view}
      label="Tools"
      status={isLoading ? 'Checking' : countStatus(count)}
      description={count > 0 ? `${count} tool${count === 1 ? '' : 's'} available.` : 'No tools are configured.'}
      docsHref="https://mastra.ai/docs/agents/using-tools-and-mcp"
      enabled={count > 0}
      tone="emerald"
      icon={<Wrench />}
    />
  );
}

function WorkflowsCapability({ agentId, view }: AgentCapabilityProps) {
  const { data: agent, isLoading } = useAgent(agentId);
  const count = getRecordCount(agent?.workflows);

  return (
    <CapabilityItem
      view={view}
      label="Workflows"
      status={isLoading ? 'Checking' : countStatus(count)}
      description={
        count > 0 ? `${count} workflow${count === 1 ? '' : 's'} available.` : 'No workflows are attached to this agent.'
      }
      docsHref="https://mastra.ai/docs/workflows/overview"
      enabled={count > 0}
      tone="sky"
      icon={<WorkflowIcon />}
    />
  );
}

function SubAgentsCapability({ agentId, view }: AgentCapabilityProps) {
  const { data: agent, isLoading } = useAgent(agentId);
  const count = getRecordCount(agent?.agents);

  return (
    <CapabilityItem
      view={view}
      label="Sub-agents"
      status={isLoading ? 'Checking' : countStatus(count)}
      description={
        count > 0
          ? `${count} sub-agent${count === 1 ? '' : 's'} available.`
          : 'No sub-agents are attached to this agent.'
      }
      docsHref="https://mastra.ai/docs/agents/supervisor-agents"
      enabled={count > 0}
      tone="cyan"
      icon={<Bot />}
    />
  );
}

function ProcessorsCapability({ agentId, view }: AgentCapabilityProps) {
  const { data: agent, isLoading } = useAgent(agentId);
  const count = getProcessorCount(agent);

  return (
    <CapabilityItem
      view={view}
      label="Processors"
      status={isLoading ? 'Checking' : countStatus(count)}
      description={
        count > 0
          ? `${count} input/output processor${count === 1 ? '' : 's'} configured.`
          : 'No input or output processors are configured.'
      }
      docsHref="https://mastra.ai/docs/agents/processors"
      enabled={count > 0}
      tone="orange"
      icon={<SlidersHorizontal />}
    />
  );
}

function CapabilitiesSummary({ agentId }: { agentId: string }) {
  const { data: memory } = useMemory(agentId);
  const { data: agent } = useAgent(agentId);
  const { isCmsAvailable } = useIsCmsAvailable();

  const enabledFlags = [
    hasConfiguredMemory(memory),
    isEditorAvailable(agent, isCmsAvailable),
    getRecordCount(agent?.tools) > 0,
    getRecordCount(agent?.workflows) > 0,
    getRecordCount(agent?.agents) > 0,
    getProcessorCount(agent) > 0,
  ];
  const enabledCount = enabledFlags.filter(Boolean).length;

  return (
    <Txt as="span" variant="ui-xs" className="shrink-0 text-neutral3">
      {enabledCount}/{enabledFlags.length}
    </Txt>
  );
}

export function AgentCapabilitiesFooter({ agentId }: { agentId: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

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
              <MemoryCapability agentId={agentId} view="chip" />
              <EditorCapability agentId={agentId} view="chip" />
              <ToolsCapability agentId={agentId} view="chip" />
              <WorkflowsCapability agentId={agentId} view="chip" />
              <SubAgentsCapability agentId={agentId} view="chip" />
              <ProcessorsCapability agentId={agentId} view="chip" />
            </div>
            <CapabilitiesSummary agentId={agentId} />
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
            <MemoryCapability agentId={agentId} view="row" />
            <EditorCapability agentId={agentId} view="row" />
            <ToolsCapability agentId={agentId} view="row" />
            <WorkflowsCapability agentId={agentId} view="row" />
            <SubAgentsCapability agentId={agentId} view="row" />
            <ProcessorsCapability agentId={agentId} view="row" />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
