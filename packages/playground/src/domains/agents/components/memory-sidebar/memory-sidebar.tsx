import type { StorageThreadType } from '@mastra/core/memory';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { MemoryIcon } from '@mastra/playground-ui/icons/MemoryIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronDown, ChevronUp, Eye, MessageSquare, NotebookPen, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { AgentCapabilitiesFooter } from './agent-capabilities-footer';
import { AgentMemory } from './agent-memory';
import { MemoryDetailView } from './memory-detail-view';
import { useMemoryFeatureFlags } from './use-memory-feature-flags';
import { useMemorySidebarTab } from './use-memory-sidebar-tab';
import '../agent-view-transition.css';
import { ChatThreads } from '@/domains/agents/components/chat-threads';
import { SidebarPanel } from '@/domains/agents/components/sidebar-panel';
import { useMemoryTimeline, useObservationalMemoryContext } from '@/domains/agents/context';

import { useMemory } from '@/domains/memory/hooks/use-memory';

export interface MemorySidebarProps {
  agentId: string;
  threadId: string;
  threads: StorageThreadType[];
  onDelete: (threadId: string) => void;
}

const barColor = (percent: number): string => {
  if (percent >= 85) return 'bg-orange-400';
  if (percent >= 60) return 'bg-blue-500';
  return 'bg-green-500';
};

type ConfigBadgeProps = {
  icon: LucideIcon;
  tooltip: string;
  enabled: boolean;
  value?: number;
};

function ConfigBadge({ icon: Icon, tooltip, enabled, value }: ConfigBadgeProps) {
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
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function MemorySidebarSkeleton() {
  return (
    <div data-testid="memory-sidebar-skeleton" className="flex h-full min-h-0 w-full flex-col gap-2.5 p-3">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

// SidebarPanel is the single layout shell; the body picks the view with guard
// clauses and returns bare content — see structure-early-return-render-branches.
export function MemorySidebar({ agentId, threadId, threads, onDelete }: MemorySidebarProps) {
  return (
    <SidebarPanel>
      <MemorySidebarBody agentId={agentId} threadId={threadId} threads={threads} onDelete={onDelete} />
    </SidebarPanel>
  );
}

function MemorySidebarBody({ agentId, threadId, threads, onDelete }: MemorySidebarProps) {
  // Derive memory state from the shared (React Query deduped) hook instead of
  // accepting it as props — see structure-derive-dont-duplicate.
  const { data: memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const hasMemory = Boolean(memory?.result);
  const memoryType = memory?.memoryType;

  const { selectedTab, handleTabChange } = useMemorySidebarTab();
  const { isPanelOpen } = useMemoryTimeline();
  const { streamProgress } = useObservationalMemoryContext();
  const { lastMessages, semanticRecallOn, workingMemoryOn, observationalOn } = useMemoryFeatureFlags(agentId);

  const showMemory = selectedTab === 'memory';
  const memoryCardShellRef = useRef<HTMLDivElement>(null);
  const memoryCardButtonRef = useRef<HTMLButtonElement>(null);
  const [collapsedCardSize, setCollapsedCardSize] = useState({ height: 0, offset: 0 });

  const showMemoryDetail = observationalOn && isPanelOpen;

  // streamProgress is intentionally retained across thread switches (for reload
  // display), so only trust it for the thread this card belongs to — otherwise the
  // collapsed bar keeps the previous thread's percentage.
  const messagesWindow = streamProgress?.threadId === threadId ? streamProgress.windows?.active?.messages : undefined;
  const observationPercent =
    messagesWindow && messagesWindow.threshold > 0
      ? Math.min(100, Math.round((messagesWindow.tokens / messagesWindow.threshold) * 100))
      : undefined;

  useLayoutEffect(() => {
    if (showMemory || showMemoryDetail || !hasMemory) return;

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
  }, [
    hasMemory,
    lastMessages,
    observationPercent,
    observationalOn,
    semanticRecallOn,
    showMemory,
    showMemoryDetail,
    workingMemoryOn,
  ]);

  // Mutually exclusive views, each an early return of bare content.
  if (isMemoryLoading) {
    return <MemorySidebarSkeleton />;
  }

  if (showMemoryDetail) {
    return (
      <div data-testid="memory-sidebar-panel" className="h-full min-h-0 min-w-0">
        <MemoryDetailView agentId={agentId} threadId={threadId} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          aria-hidden={showMemory && hasMemory}
          inert={showMemory && hasMemory ? true : undefined}
          data-testid="memory-sidebar-thread-layer"
          className={cn(
            'memory-sidebar-thread-layer absolute inset-0 flex min-h-0 flex-col overflow-hidden',
            showMemory && hasMemory ? 'pointer-events-none opacity-0' : 'opacity-100',
          )}
        >
          <div
            className="min-h-0 flex-1 overflow-hidden"
            style={{ paddingBottom: hasMemory ? collapsedCardSize.offset || undefined : undefined }}
          >
            {hasMemory ? (
              <ChatThreads
                resourceId={agentId}
                resourceType="agent"
                threads={threads}
                threadId={threadId}
                onDelete={onDelete}
                embedded
              />
            ) : (
              <EmptyState
                iconSlot={null}
                titleSlot="Memory not enabled"
                descriptionSlot="Conversations are only saved as threads when the agent has memory configured."
                actionSlot={
                  <Button
                    as="a"
                    href="https://mastra.ai/docs/memory/overview"
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outline"
                  >
                    View documentation
                  </Button>
                }
              />
            )}
          </div>
        </div>

        {hasMemory ? (
          <div
            ref={memoryCardShellRef}
            data-testid="memory-sidebar-overlay"
            className={cn(
              'memory-sidebar-overlay absolute inset-x-0 bottom-0 z-10 box-border flex min-h-0 flex-col overflow-hidden border',
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
                  <ChevronDown className="h-4 w-4 shrink-0 text-neutral3" />
                ) : (
                  <ChevronUp className="h-4 w-4 shrink-0 text-neutral3" />
                )}
              </span>

              {!showMemory ? (
                <TooltipProvider delay={150} timeout={400}>
                  {/* Memory setup at a glance: filled badge = on, faded = off */}
                  <span data-testid="memory-config-badges" className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <ConfigBadge
                      icon={MessageSquare}
                      tooltip={
                        lastMessages !== undefined
                          ? `Keeps the last ${lastMessages} messages in context`
                          : 'Recent message history is off'
                      }
                      enabled={lastMessages !== undefined}
                      value={lastMessages}
                    />
                    <ConfigBadge
                      icon={Search}
                      tooltip={
                        semanticRecallOn
                          ? 'Semantic recall is on - retrieves relevant past messages'
                          : 'Semantic recall is off'
                      }
                      enabled={semanticRecallOn}
                    />
                    <ConfigBadge
                      icon={NotebookPen}
                      tooltip={
                        workingMemoryOn
                          ? 'Working memory is on - persists notes across the conversation'
                          : 'Working memory is off'
                      }
                      enabled={workingMemoryOn}
                    />
                    <ConfigBadge
                      icon={Eye}
                      tooltip={
                        observationalOn
                          ? 'Observational memory is on - learns from the conversation'
                          : 'Observational memory is off'
                      }
                      enabled={observationalOn}
                    />
                  </span>
                </TooltipProvider>
              ) : null}

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
        ) : null}
      </div>

      <AgentCapabilitiesFooter agentId={agentId} />
    </div>
  );
}
