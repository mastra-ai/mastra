import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../ds/components/Tooltip';
import { Txt } from '../../../ds/components/Txt';
import { IconChatBubble7 } from '../../../ds/icons/central/IconChatBubble7';
import { IconChevronDownMedium } from '../../../ds/icons/central/IconChevronDownMedium';
import { IconChevronTopMedium } from '../../../ds/icons/central/IconChevronTopMedium';
import { IconEyeOpen } from '../../../ds/icons/central/IconEyeOpen';
import { IconMagnifyingGlass } from '../../../ds/icons/central/IconMagnifyingGlass';
import { IconWrite } from '../../../ds/icons/central/IconWrite';
import { MemoryIcon } from '../../../ds/icons/MemoryIcon';
import { raisedSurfaceStyle } from '../../../ds/primitives/raised-surface';
import { cn } from '../../../utils/cn';

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
      <TooltipTrigger asChild>
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
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export interface MemorySidebarViewProps {
  hasMemory: boolean;
  showMemory: boolean;
  recentMessages: { description: string; enabled: boolean; maxMessages?: number };
  semanticRecallOn: boolean;
  workingMemoryOn: boolean;
  observationalOn: boolean;
  observationPercent?: number;
  threadsSlot: ReactNode;
  memorySlot: ReactNode;
  footerSlot: ReactNode;
  onTabChange: (tab: 'memory' | 'threads') => void;
}

export function MemorySidebarView({
  hasMemory,
  showMemory,
  recentMessages,
  semanticRecallOn,
  workingMemoryOn,
  observationalOn,
  observationPercent,
  threadsSlot,
  memorySlot,
  footerSlot,
  onTabChange,
}: MemorySidebarViewProps) {
  const memoryCardShellRef = useRef<HTMLDivElement>(null);
  const memoryCardButtonRef = useRef<HTMLButtonElement>(null);
  const [collapsedCardSize, setCollapsedCardSize] = useState({ height: 0, offset: 0 });
  useLayoutEffect(() => {
    if (showMemory || !hasMemory) return;

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
    recentMessages.description,
    observationPercent,
    observationalOn,
    semanticRecallOn,
    showMemory,
    workingMemoryOn,
  ]);

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
            {threadsSlot}
          </div>
        </div>

        {hasMemory ? (
          <div
            ref={memoryCardShellRef}
            data-testid="memory-sidebar-overlay"
            className={cn(
              'memory-sidebar-overlay absolute inset-x-0 bottom-0 z-10 box-border flex min-h-0 flex-col overflow-hidden',
              showMemory ? cn(raisedSurfaceStyle, 'top-1 m-1 rounded-xl') : 'm-1 rounded-xl bg-nested state-layer',
            )}
            style={{ height: showMemory ? undefined : collapsedCardSize.height || undefined }}
          >
            <button
              ref={memoryCardButtonRef}
              type="button"
              onClick={() => onTabChange(showMemory ? 'threads' : 'memory')}
              aria-pressed={showMemory}
              data-testid="memory-sidebar-card"
              className="group/memory-card w-full shrink-0 cursor-pointer bg-transparent px-3 py-2.5 text-left"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-foreground">
                  <MemoryIcon className="size-icon-md shrink-0" />
                  <Txt as="span" variant="column">
                    Memory
                  </Txt>
                </span>
                {showMemory ? (
                  <IconChevronDownMedium className="size-icon-md shrink-0 text-muted-foreground" />
                ) : (
                  <IconChevronTopMedium className="size-icon-md shrink-0 text-muted-foreground" />
                )}
              </span>

              {!showMemory ? (
                <TooltipProvider delay={150} timeout={400}>
                  {/* Memory setup at a glance: filled badge = on, faded = off */}
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
              ) : null}

              {observationPercent !== undefined ? (
                <span
                  data-testid="memory-card-observation-bar"
                  data-percent={observationPercent}
                  className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-fill"
                >
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
              <div className="memory-card-content min-h-0 flex-1 overflow-y-auto border-t border-border">
                {memorySlot}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {footerSlot}
    </div>
  );
}
