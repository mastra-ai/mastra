import { AgentChat } from '@mastra/playground-ui/domains/agents/components/agent-chat';
import type { AgentChatProps } from '@mastra/playground-ui/domains/agents/components/agent-chat';
import { AgentChannelsCard } from './agent-channels/agent-channels-card';
import { BrowserThumbnail } from './browser-view';
import { useBrowserSession } from '@/domains/agents/context/browser-session-context';
import { useVoiceCall, VoiceCallButton, VoiceCallPanel } from '@/domains/voice';

/** The shared agent chat with Studio's voice calls, browser thumbnail and channels card plugged in. */
export function StudioAgentChat(props: AgentChatProps) {
  const { agentId, agentName, threadId, refreshThreadList } = props;
  // On a brand-new chat, starting the call must transition the page out of its
  // new-thread state (same as the first text send) or the chat never loads messages.
  const voiceCall = useVoiceCall({ agentId, threadId, onCallStarted: refreshThreadList });
  const { hasSession, viewMode } = useBrowserSession();
  const showThumbnail = hasSession && (viewMode === 'collapsed' || viewMode === 'expanded') && Boolean(threadId);

  return (
    <AgentChat
      {...props}
      landingSlot={<AgentChannelsCard agentId={agentId} />}
      transcriptTopSlot={showThumbnail ? <BrowserThumbnail agentName={agentName} /> : undefined}
      composerTopSlot={<VoiceCallPanel voiceCall={voiceCall} />}
      composerActionsSlot={<VoiceCallButton voiceCall={voiceCall} />}
    />
  );
}
