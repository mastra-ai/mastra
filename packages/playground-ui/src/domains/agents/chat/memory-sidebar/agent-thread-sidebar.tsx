import { useMemory } from '@mastra/react/hooks/memory';
import type { LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMemoryFeatureFlags } from './use-memory-feature-flags';
import { useMemorySidebarTab } from './use-memory-sidebar-tab';
import { useEntityRequestContext } from '@/domains/request-context/hooks/use-entity-request-context';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Skeleton } from '@/ds/components/Skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { IconChatBubble7 } from '@/ds/icons/central/IconChatBubble7';
import { IconChevronDownMedium } from '@/ds/icons/central/IconChevronDownMedium';
import { IconChevronTopMedium } from '@/ds/icons/central/IconChevronTopMedium';
import { IconEyeOpen } from '@/ds/icons/central/IconEyeOpen';
import { IconMagnifyingGlass } from '@/ds/icons/central/IconMagnifyingGlass';
import { IconSquareArrowTopRight } from '@/ds/icons/central/IconSquareArrowTopRight';
import { IconWrite } from '@/ds/icons/central/IconWrite';
import { MemoryIcon } from '@/ds/icons/MemoryIcon';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/utils/cn';
import './agent-thread-sidebar.css';

/** Host-specific memory content placed inside the shared sidebar structure. */
export interface AgentThreadSidebarExtensions {
  /** Observation-window fill shown on the collapsed Memory card. */
  observationPercent?: number;
  /** Expanded Memory card content. Without it the card is a static summary. */
  memoryContent?: ReactNode;
  /** Replaces the sidebar body while a host memory detail view is open. */
  memoryDetail?: ReactNode;
  footer?: ReactNode;
  /** Show the memory capability badges on the collapsed Memory card. Defaults to true. */
  showConfigBadges?: boolean;
}

export interface AgentThreadSidebarProps extends AgentThreadSidebarExtensions {
  agentId: string;
  threadList: ReactNode;
  /** While the page loads, keep the thread list in place instead of the memory skeleton. */
  isLoading?: boolean;
}

const barColor = (percent: number): string => {
  if (percent >= 85) return 'bg-warning-indicator';
  if (percent >= 60) return 'bg-info-indicator';
  return 'bg-success-indicator';
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
      <TooltipTrigger
        render={
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 transition-colors duration-normal',
              enabled ? 'border-border bg-muted text-foreground' : 'border-border text-subtle-foreground',
            )}
          >
            <Icon className="size-3 shrink-0" />
            {value !== undefined && (
              <Txt as="span" variant="meta" className="tabular-nums">
                {value}
              </Txt>
            )}
          </span>
        }
      />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function MemorySidebarSkeleton() {
  return (
    <div data-testid="memory-sidebar-skeleton" className="flex size-full min-h-0 flex-col gap-2.5 p-3">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function AgentThreadSidebar({
  agentId,
  threadList,
  isLoading = false,
  observationPercent,
  memoryContent,
  memoryDetail,
  footer,
  showConfigBadges = true,
}: AgentThreadSidebarProps) {
  const [requestContext] = useEntityRequestContext('agent', agentId);
  const { data: memory, isLoading: isMemoryLoading } = useMemory({
    agentId,
    requestContext,
    queryOptions: { enabled: Boolean(agentId) },
  });
  const hasMemory = Boolean(memory?.result);
  const { selectedTab, handleTabChange } = useMemorySidebarTab();
  const { recentMessages, semanticRecallOn, workingMemoryOn, observationalOn } = useMemoryFeatureFlags(agentId);

  const canExpand = memoryContent !== undefined;
  const showMemory = canExpand && selectedTab === 'memory';
  const memoryCardShellRef = useRef<HTMLDivElement>(null);
  const memoryCardSummaryRef = useRef<HTMLElement>(null);
  const [collapsedCardSize, setCollapsedCardSize] = useState({ height: 0, offset: 0 });

  useLayoutEffect(() => {
    if (showMemory || memoryDetail || !hasMemory || isLoading || isMemoryLoading) return;

    const shell = memoryCardShellRef.current;
    const summary = memoryCardSummaryRef.current;
    if (!shell || !summary) return;

    const updateCollapsedSize = () => {
      const shellStyles = getComputedStyle(shell);
      const borderTop = Number.parseFloat(shellStyles.borderTopWidth) || 0;
      const borderBottom = Number.parseFloat(shellStyles.borderBottomWidth) || 0;
      const marginTop = Number.parseFloat(shellStyles.marginTop) || 0;
      const marginBottom = Number.parseFloat(shellStyles.marginBottom) || 0;
      const height = Math.ceil(summary.getBoundingClientRect().height + borderTop + borderBottom);
      const offset = Math.ceil(height + marginTop + marginBottom);

      setCollapsedCardSize(current =>
        current.height === height && current.offset === offset ? current : { height, offset },
      );
    };

    updateCollapsedSize();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(updateCollapsedSize);
    observer.observe(summary);
    return () => observer.disconnect();
  }, [
    hasMemory,
    isLoading,
    isMemoryLoading,
    memoryDetail,
    recentMessages.description,
    observationPercent,
    observationalOn,
    semanticRecallOn,
    showConfigBadges,
    showMemory,
    workingMemoryOn,
  ]);

  if (isLoading) {
    return <div className="flex size-full min-h-0 flex-col overflow-hidden">{threadList}</div>;
  }

  if (isMemoryLoading) {
    return <MemorySidebarSkeleton />;
  }

  if (memoryDetail) {
    return (
      <div data-testid="memory-sidebar-panel" className="h-full min-h-0 min-w-0">
        {memoryDetail}
      </div>
    );
  }

  const summary = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-foreground">
          <MemoryIcon className="size-icon-md shrink-0" />
          <Txt as="span" variant="column">
            Memory
          </Txt>
        </span>
        {canExpand ? (
          showMemory ? (
            <IconChevronDownMedium className="size-icon-md shrink-0 text-muted-foreground" />
          ) : (
            <IconChevronTopMedium className="size-icon-md shrink-0 text-muted-foreground" />
          )
        ) : undefined}
      </span>

      {!showMemory && showConfigBadges ? (
        <TooltipProvider delay={150} timeout={400}>
          <span data-testid="memory-config-badges" className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ConfigBadge
              icon={IconChatBubble7}
              tooltip={recentMessages.description}
              enabled={recentMessages.enabled}
              value={recentMessages.maxMessages}
            />
            <ConfigBadge
              icon={IconMagnifyingGlass}
              tooltip={
                semanticRecallOn
                  ? 'Semantic recall is on and retrieves relevant past messages'
                  : 'Semantic recall is off'
              }
              enabled={semanticRecallOn}
            />
            <ConfigBadge
              icon={IconWrite}
              tooltip={
                workingMemoryOn
                  ? 'Working memory is on and persists notes across the conversation'
                  : 'Working memory is off'
              }
              enabled={workingMemoryOn}
            />
            <ConfigBadge
              icon={IconEyeOpen}
              tooltip={
                observationalOn
                  ? 'Observational memory is on and learns from the conversation'
                  : 'Observational memory is off'
              }
              enabled={observationalOn}
            />
          </span>
        </TooltipProvider>
      ) : undefined}

      {observationPercent !== undefined ? (
        <span
          data-testid="memory-card-observation-bar"
          data-percent={observationPercent}
          className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-fill"
        >
          <span
            className={cn('block h-full rounded-full transition-all duration-normal', barColor(observationPercent))}
            style={{ width: `${observationPercent}%` }}
          />
        </span>
      ) : undefined}
    </>
  );
  const summaryClassName = 'w-full shrink-0 bg-transparent px-3 py-2.5 text-left';

  return (
    <div className="flex size-full min-h-0 flex-col overflow-hidden">
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
              threadList
            ) : (
              <EmptyState
                titleSlot="Memory not enabled"
                descriptionSlot="Conversations are only saved as threads when the agent has memory configured."
                actionSlot={
                  <Button
                    icon={<IconSquareArrowTopRight />}
                    render={
                      <a href="https://mastra.ai/docs/memory/overview" target="_blank" rel="noopener noreferrer" />
                    }
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
              'memory-sidebar-overlay absolute inset-x-0 bottom-0 z-10 box-border flex min-h-0 flex-col overflow-hidden',
              showMemory
                ? cn(raisedSurfaceStyle, 'top-1 m-1 rounded-xl')
                : cn('m-1 rounded-xl border border-surface-rim bg-muted', canExpand && 'state-layer'),
            )}
            style={{ height: showMemory ? undefined : collapsedCardSize.height || undefined }}
          >
            {canExpand ? (
              <button
                ref={element => {
                  memoryCardSummaryRef.current = element;
                }}
                type="button"
                onClick={() => handleTabChange(showMemory ? 'threads' : 'memory')}
                aria-pressed={showMemory}
                data-testid="memory-sidebar-card"
                className={cn('group/memory-card cursor-pointer', summaryClassName)}
              >
                {summary}
              </button>
            ) : (
              <div
                ref={element => {
                  memoryCardSummaryRef.current = element;
                }}
                data-testid="memory-sidebar-card"
                className={summaryClassName}
              >
                {summary}
              </div>
            )}

            {showMemory && (
              <div className="memory-card-content min-h-0 flex-1 overflow-y-auto border-t border-border">
                {memoryContent}
              </div>
            )}
          </div>
        ) : undefined}
      </div>

      {footer}
    </div>
  );
}
