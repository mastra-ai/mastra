import { AgentChat } from '../components/agent-chat';
import type { AgentChatProps } from '../components/agent-chat';
import { AgentOverviewPanel } from '../components/agent-overview-panel/agent-overview-panel';
import { ActivatedSkillsProvider } from '../context/activated-skills-context';
import { AgentSettingsProvider } from '../context/agent-context';
import type { AgentSettingsType } from '../context/agent-context';
import { ObservationalMemoryProvider } from '../context/agent-observational-memory-context';
import { WorkingMemoryProvider } from '../context/agent-working-memory-context';
import { BrowserToolCallsProvider } from '../context/browser-tool-calls-context';
import { ThreadInputProvider } from '@/domains/conversation/context/ThreadInputContext';
import { cn } from '@/utils/cn';

export interface AgentSessionProps extends AgentChatProps {
  /** Initial model settings, e.g. from `buildAgentDefaultSettings(agent)`. */
  defaultSettings?: AgentSettingsType;
  /** Memory resource the thread belongs to. Defaults to `agentId`, matching Studio. */
  resourceId?: string;
  /** Render the Config panel next to the chat. Defaults to true. */
  showConfigPanel?: boolean;
  /** Host-provided Channels section inside the Config panel. */
  configChannelsSlot?: React.ReactNode;
  /** Host-provided notice under the system prompt in the Config panel. */
  configSystemPromptNoticeSlot?: React.ReactNode;
  className?: string;
}

/**
 * One agent thread with Studio's chat and Config panel, wired with the providers the chat needs.
 *
 * Data flows through `@mastra/react` hooks, so the host owns the data plane via `MastraReactProvider`.
 * Thread selection is the host's job: pair this with `useThreads` and `ThreadList` and pass `threadId`.
 * Host-only features (voice, browser sessions, channels) plug in through the slots.
 */
export function AgentSession({
  defaultSettings,
  resourceId,
  showConfigPanel = true,
  configChannelsSlot,
  configSystemPromptNoticeSlot,
  className,
  ...chatProps
}: AgentSessionProps) {
  const { agentId, threadId } = chatProps;

  return (
    <AgentSettingsProvider agentId={agentId} defaultSettings={defaultSettings}>
      <WorkingMemoryProvider agentId={agentId} threadId={threadId} resourceId={resourceId ?? agentId}>
        <BrowserToolCallsProvider key={`browser-${agentId}-${threadId}`}>
          <ThreadInputProvider>
            <ObservationalMemoryProvider>
              <ActivatedSkillsProvider key={`${agentId}-${threadId}`}>
                <div
                  className={cn(
                    'grid h-full min-h-0 gap-3',
                    // A fixed-width track, not minmax(length,length): lightningcss drops grid
                    // templates whose minmax() has no flexible argument.
                    showConfigPanel ? 'grid-cols-[minmax(0,1fr)_20rem]' : 'grid-cols-1',
                    className,
                  )}
                >
                  <div className="relative grid h-full min-h-0">
                    <AgentChat key={threadId} {...chatProps} />
                  </div>
                  {showConfigPanel && (
                    <AgentOverviewPanel
                      agentId={agentId}
                      channelsSlot={configChannelsSlot}
                      systemPromptNoticeSlot={configSystemPromptNoticeSlot}
                    />
                  )}
                </div>
              </ActivatedSkillsProvider>
            </ObservationalMemoryProvider>
          </ThreadInputProvider>
        </BrowserToolCallsProvider>
      </WorkingMemoryProvider>
    </AgentSettingsProvider>
  );
}
