import { AgentOverviewPanel } from '../config-panel/agent-overview-panel';
import { AgentChat } from './agent-chat';
import type { AgentChatProps } from './agent-chat';
import { AgentSettingsProvider } from './context/agent-context';
import { ObservationalMemoryProvider } from './context/agent-observational-memory-context';
import { WorkingMemoryProvider } from './context/agent-working-memory-context';
import { ThreadInputProvider } from './thread-input';
import type { AgentSettingsType } from './types';
import { ActivatedSkillsProvider } from '@/domains/agents/context/activated-skills-context';
import { cn } from '@/utils/cn';

export interface AgentSessionProps extends AgentChatProps {
  /** Initial model settings for the settings dialog (persisted per agent by the provider). */
  defaultSettings?: AgentSettingsType;
  /** Memory resource id. Defaults to the agent id, matching Studio's behaviour. */
  resourceId?: string;
  /** Render the Config side panel next to the chat. Defaults to true. */
  showConfigPanel?: boolean;
  /** Host-provided channels section inside the config panel. */
  configChannelsSlot?: React.ReactNode;
  /** Host-provided notice inside the config panel's system prompt section. */
  configSystemPromptNoticeSlot?: React.ReactNode;
  className?: string;
}

/**
 * Framework-owned agent session view: chat pane plus the agent Config panel,
 * wired with the providers the chat runtime needs (settings, working memory,
 * observational memory, thread drafts, activated skills).
 *
 * Data flows exclusively through `@mastra/react` hooks, so the host controls
 * the data plane via `MastraReactProvider` (`baseUrl`, `customFetch`). All
 * agent fields are treated as optional — older servers or pruned registries
 * simply render fewer sections.
 *
 * Host-specific features (voice, browser sessions, channels) are injected
 * through slots rather than bundled here.
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
        <ThreadInputProvider>
          <ObservationalMemoryProvider>
            <ActivatedSkillsProvider>
              <div
                className={cn(
                  'grid h-full min-h-0 gap-3',
                  showConfigPanel ? 'grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]' : 'grid-cols-1',
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
      </WorkingMemoryProvider>
    </AgentSettingsProvider>
  );
}
