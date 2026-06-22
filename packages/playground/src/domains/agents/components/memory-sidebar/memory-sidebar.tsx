import type { StorageThreadType } from '@mastra/core/memory';
import {
  Button,
  EmptyState,
  MemoryIcon,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Txt,
  cn,
} from '@mastra/playground-ui';
import { ChevronDown, ChevronUp, Eye, MessageSquare, NotebookPen, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { AgentMemory } from './agent-memory';
import { useMemorySidebarTab } from './use-memory-sidebar-tab';
import '../agent-view-transition.css';
import { ChatThreads } from '@/domains/agents/components/chat-threads';
import { SidebarPanel } from '@/domains/agents/components/sidebar-panel';
import { useObservationalMemoryContext } from '@/domains/agents/context';
import { useMemoryConfig } from '@/domains/memory/hooks';

export interface MemorySidebarProps {
  agentId: string;
  threadId: string;
  threads?: StorageThreadType[];
  isLoading: boolean;
  onDelete: (threadId: string) => void;
  memoryType?: 'local' | 'gateway';
  hasMemory: boolean;
}

const barColor = (percent: number): string => {
  if (percent >= 85) return 'bg-orange-400';
  if (percent >= 60) return 'bg-blue-500';
  return 'bg-green-500';
};

type ConfigBadgeProps = {
  icon: LucideIcon;
  label: string;
  tooltip: string;
  enabled: boolean;
  value?: number;
  expanded: boolean;
};

function ConfigBadge({ icon: Icon, label, tooltip, enabled, value, expanded }: ConfigBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 transition-colors duration-normal',
            enabled ? 'border-border1 bg-surface4 text-neutral6' : 'border-border1/40 text-neutral3/50',
          )}
        >
          <Icon className="h-3 w-3 shrink-0" />
          {value !== undefined && (
            <Txt as="span" variant="ui-xs" className="font-medium tabular-nums leading-none">
              {value}
            </Txt>
          )}
          {expanded && (
            <Txt as="span" variant="ui-xs" className="whitespace-nowrap leading-none">
              {label}
            </Txt>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function MemorySidebar({
  agentId,
  threadId,
  threads,
  isLoading,
  onDelete,
  memoryType,
  hasMemory,
}: MemorySidebarProps) {
  const { selectedTab, handleTabChange } = useMemorySidebarTab();
  const { streamProgress } = useObservationalMemoryContext();
  const { data: memoryConfig } = useMemoryConfig(agentId);
  const showMemory = selectedTab === 'memory';
  const memoryCardShellRef = useRef<HTMLDivElement>(null);
  const memoryCardButtonRef = useRef<HTMLButtonElement>(null);
  const [collapsedCardSize, setCollapsedCardSize] = useState({ height: 0, offset: 0 });

  const config = memoryConfig?.config;
  const lastMessages = typeof config?.lastMessages === 'number' ? config.lastMessages : undefined;
  const semanticRecallOn = Boolean(config?.semanticRecall);
  const workingMemoryOn =
    typeof config?.workingMemory === 'object'
      ? Boolean(config?.workingMemory?.enabled)
      : Boolean(config?.workingMemory);
  const observationalMemory = (config as { observationalMemory?: unknown } | undefined)?.observationalMemory;
  const observationalOn =
    typeof observationalMemory === 'object'
      ? Boolean((observationalMemory as { enabled?: boolean })?.enabled)
      : Boolean(observationalMemory);

  // streamProgress is intentionally retained across thread switches (for reload
  // display), so only trust it for the thread this card belongs to — otherwise the
  // collapsed bar keeps the previous thread's percentage.
  const messagesWindow = streamProgress?.threadId === threadId ? streamProgress.windows?.active?.messages : undefined;
  const observationPercent =
    messagesWindow && messagesWindow.threshold > 0
      ? Math.min(100, Math.round((messagesWindow.tokens / messagesWindow.threshold) * 100))
      : undefined;

  useLayoutEffect(() => {
    if (showMemory) return;

    const shell = memoryCardShellRef.current;
    const button = memoryCardButtonRef.current;
    if (!shell || !button) return;

    const updateCollapsedSize = () => {
      const shellStyles = getComputedStyle(shell);
      const borderTop = Number.parseFloat(shellStyles.borderTopWidth) || 0;
      const borderBottom = Number.parseFloat(shellStyles.borderBottomWidth) || 0;
      const marginTop = Number.parseFloat(shellStyles.marginTop) || 0;
      const marginBottom = Number.parseFloat(shellStyles.marginBottom) || 0;
      const height = Math.ceil(button.getBoundingClientRect().height + borderTop + borderBottom);
      const offset = Math.ceil(height + marginTop + marginBottom);

      setCollapsedCardSize(current =>
        current.height === height && current.offset === offset ? current : { height, offset },
      );
    };

    updateCollapsedSize();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(updateCollapsedSize);
    observer.observe(button);
    return () => observer.disconnect();
  }, [lastMessages, observationPercent, observationalOn, semanticRecallOn, showMemory, workingMemoryOn]);

  return (
    <SidebarPanel>
      {hasMemory ? (
        <div className="relative h-full min-h-0 w-full overflow-hidden">
          <div
            aria-hidden={showMemory}
            inert={showMemory ? true : undefined}
            data-testid="memory-sidebar-thread-layer"
            className={cn(
              'memory-sidebar-thread-layer absolute inset-0 min-h-0 overflow-y-auto',
              showMemory ? 'pointer-events-none opacity-0' : 'opacity-100',
            )}
            style={{ paddingTop: collapsedCardSize.offset || undefined }}
          >
            <ChatThreads
              resourceId={agentId}
              resourceType="agent"
              threads={threads || []}
              isLoading={isLoading}
              threadId={threadId}
              onDelete={onDelete}
              embedded
            />
          </div>

          <div
            ref={memoryCardShellRef}
            data-testid="memory-sidebar-overlay"
            className={cn(
              'memory-sidebar-overlay absolute inset-x-0 top-0 z-10 box-border flex min-h-0 flex-col overflow-hidden border',
              showMemory
                ? 'm-0 rounded-none border-transparent bg-surface3 shadow-none'
                : 'm-1 rounded-xl border-border1/40 bg-surface4 hover:bg-surface5 active:bg-surface4',
            )}
            style={{ height: showMemory ? '100%' : collapsedCardSize.height || undefined }}
          >
            <button
              ref={memoryCardButtonRef}
              type="button"
              onClick={() => handleTabChange(showMemory ? 'threads' : 'memory')}
              aria-pressed={showMemory}
              data-testid="memory-sidebar-card"
              className="group/memory-card w-full shrink-0 cursor-pointer bg-transparent px-3 py-2.5 text-left"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-neutral6">
                  <MemoryIcon className="h-4 w-4 shrink-0" />
                  <Txt as="span" variant="ui-sm" className="font-medium">
                    Memory
                  </Txt>
                </span>
                {showMemory ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-neutral3" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-neutral3" />
                )}
              </span>

              {/* Memory setup at a glance: filled badge = on, faded = off */}
              <TooltipProvider delay={150} timeout={400}>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <ConfigBadge
                    icon={MessageSquare}
                    label="recent messages"
                    tooltip={
                      lastMessages !== undefined
                        ? `Keeps the last ${lastMessages} messages in context`
                        : 'Recent message history is off'
                    }
                    enabled={lastMessages !== undefined}
                    value={lastMessages}
                    expanded={showMemory}
                  />
                  <ConfigBadge
                    icon={Search}
                    label="Semantic recall"
                    tooltip={
                      semanticRecallOn
                        ? 'Semantic recall is on - retrieves relevant past messages'
                        : 'Semantic recall is off'
                    }
                    enabled={semanticRecallOn}
                    expanded={showMemory}
                  />
                  <ConfigBadge
                    icon={NotebookPen}
                    label="Working memory"
                    tooltip={
                      workingMemoryOn
                        ? 'Working memory is on - persists notes across the conversation'
                        : 'Working memory is off'
                    }
                    enabled={workingMemoryOn}
                    expanded={showMemory}
                  />
                  <ConfigBadge
                    icon={Eye}
                    label="Observational"
                    tooltip={
                      observationalOn
                        ? 'Observational memory is on - learns from the conversation'
                        : 'Observational memory is off'
                    }
                    enabled={observationalOn}
                    expanded={showMemory}
                  />
                </span>
              </TooltipProvider>

              {observationPercent !== undefined ? (
                <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-surface5">
                  <span
                    className={cn(
                      'block h-full rounded-full transition-all duration-normal',
                      barColor(observationPercent),
                    )}
                    style={{ width: `${observationPercent}%` }}
                  />
                </span>
              ) : null}
            </button>

            {showMemory && (
              <div className="memory-card-content min-h-0 flex-1 overflow-y-auto border-t border-border1">
                <AgentMemory agentId={agentId} threadId={threadId} memoryType={memoryType} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          iconSlot={null}
          titleSlot="Memory not enabled"
          descriptionSlot="Conversations are only saved as threads when the agent has memory configured."
          actionSlot={
            <Button
              as="a"
              href="https://mastra.ai/en/docs/agents/agent-memory"
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
            >
              View documentation
            </Button>
          }
        />
      )}
    </SidebarPanel>
  );
}
