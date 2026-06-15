import type { StorageThreadType } from '@mastra/core/memory';
import { Button, EmptyState, MemoryIcon, Txt, cn } from '@mastra/playground-ui';
import { ChevronDown, ChevronUp } from 'lucide-react';
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

function ConfigDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('h-1.5 w-1.5 rounded-full', color)} />
      <Txt as="span" variant="ui-xs" className="text-neutral4">
        {label}
      </Txt>
    </span>
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

  const config = memoryConfig?.config;
  const lastMessages = typeof config?.lastMessages === 'number' ? config.lastMessages : undefined;
  const semanticRecallOn = Boolean(config?.semanticRecall);
  const workingMemoryOn =
    typeof config?.workingMemory === 'object' ? Boolean(config?.workingMemory?.enabled) : Boolean(config?.workingMemory);
  const observationalOn = Boolean(
    config && 'observationalMemory' in config && (config as { observationalMemory?: unknown }).observationalMemory,
  );

  const messagesWindow = streamProgress?.windows?.active?.messages;
  const observationPercent =
    messagesWindow && messagesWindow.threshold > 0
      ? Math.min(100, Math.round((messagesWindow.tokens / messagesWindow.threshold) * 100))
      : undefined;

  return (
    <SidebarPanel>
      {hasMemory ? (
        <>
          {/* Thread list: cedes its space to the memory card as it expands */}
          <div
            aria-hidden={showMemory}
            className={cn(
              'min-h-0 transition-all duration-normal ease-out-custom',
              showMemory ? 'overflow-hidden opacity-0 pointer-events-none' : 'overflow-y-auto opacity-100',
            )}
            style={{ flexGrow: showMemory ? 0 : 1, flexBasis: 0 }}
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

          {/* Memory card: expands in place (height + margins) into the full memory view */}
          <div
            className={cn(
              'flex min-h-0 flex-col overflow-hidden border transition-all duration-normal ease-out-custom',
              showMemory
                ? 'm-0 rounded-none border-transparent bg-surface3'
                : 'm-2 rounded-studio-panel border-border1/40 bg-surface4',
            )}
            // flex-basis stays `auto` so the collapsed card hugs its content;
            // only flex-grow animates, which is what produces the expansion.
            style={{ flexGrow: showMemory ? 1 : 0, flexShrink: 0 }}
          >
            <button
              type="button"
              onClick={() => handleTabChange(showMemory ? 'threads' : 'memory')}
              aria-pressed={showMemory}
              data-testid="memory-sidebar-card"
              className={cn(
                'group/memory-card shrink-0 px-3 py-2.5 text-left transition-colors duration-normal',
                !showMemory && 'rounded-studio-panel',
                !showMemory && 'hover:bg-surface5',
              )}
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

              {/* Memory setup at a glance */}
              <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                {lastMessages !== undefined && <ConfigDot color="bg-accent1" label={`${lastMessages} messages`} />}
                {semanticRecallOn && <ConfigDot color="bg-green-500" label="Semantic recall" />}
                {workingMemoryOn && <ConfigDot color="bg-blue-500" label="Working memory" />}
                {observationalOn && <ConfigDot color="bg-purple-400" label="Observational" />}
              </span>

              {/* Live observation progress (messages window vs threshold) when OM streams */}
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
        </>
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
