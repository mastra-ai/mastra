import {
  AgentChatFeaturesProvider,
  SpeechInputButton,
  useAgentThreadInput,
} from '@mastra/playground-ui/domains/agents/chat';
import type { AgentChatThreadInput } from '@mastra/playground-ui/domains/agents/chat';
import { ChatMessagesLoadingSkeleton } from '@mastra/playground-ui/domains/agents/chat/agent-loading-skeletons';
import { Thread as BaseThread } from '@mastra/playground-ui/domains/agents/chat/thread';
import type { ThreadProps } from '@mastra/playground-ui/domains/agents/chat/thread';
import { useChatMessages } from '@mastra/playground-ui/domains/chat/context/chat-context';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useMcpAppTools } from '@mastra/react/hooks/mcps';
import { useReadAloud } from '@mastra/react/hooks/voice';
import { toast } from 'sonner';
import { BrowserThumbnail, useBrowserSession } from '@/domains/agents';
import { AgentChannelsCard } from '@/domains/agents/components/agent-channels/agent-channels-card';
import { ComposerModelSettings } from '@/domains/agents/components/composer-model-settings';
import { ComposerModelSwitcher, ComposerModelWarning } from '@/domains/agents/components/composer-model-switcher';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useVoiceCall, VoiceCallButton, VoiceCallPanel } from '@/domains/voice';

export type { ThreadProps };

/**
 * Studio chat surface. The thread and composer live in playground-ui; this
 * wrapper supplies the Studio-only slots (voice, browser, model switcher).
 */
export function Thread(props: ThreadProps) {
  const threadInput = useAgentThreadInput(props.threadId);
  return (
    <StudioThreadFeatures {...props} threadInput={threadInput}>
      <StudioThreadBody {...props} />
    </StudioThreadFeatures>
  );
}

export function StudioComposerFeatures(props: ThreadProps & { children: React.ReactNode }) {
  const threadInput = useAgentThreadInput(props.threadId);
  return (
    <StudioThreadFeatures {...props} threadInput={threadInput}>
      {props.children}
    </StudioThreadFeatures>
  );
}

function StudioThreadFeatures({
  children,
  threadInput,
  ...props
}: ThreadProps & { children: React.ReactNode; threadInput: AgentChatThreadInput }) {
  const { canExecute } = usePermissions();
  const browser = useBrowserSession();
  const messages = useChatMessages();
  const { data: mcpAppTools } = useMcpAppTools({ queryOptions: { enabled: messages.length > 0 } });
  const [requestContext] = useEntityRequestContext('agent', props.agentId ?? '');
  const readAloud = useReadAloud(props.agentId, requestContext, {
    onError: error => toast.error(error instanceof Error ? error.message : 'Voice generation failed.'),
  });
  const voiceCall = useVoiceCall({
    agentId: props.agentId,
    threadId: props.threadId,
    onCallStarted: props.refreshThreadList,
  });

  return (
    <AgentChatFeaturesProvider
      value={{
        canExecute: canExecute('agents'),
        threadInput,
        mcpAppTools,
        readAloud,
        browser: { hasSession: browser.hasSession, viewMode: browser.viewMode },
        slots: {
          LoadingSkeleton: ChatMessagesLoadingSkeleton,
          channelsCard: agentId => <AgentChannelsCard agentId={agentId} />,
          browserThumbnail: agentName => <BrowserThumbnail agentName={agentName} />,
          modelWarning: <ComposerModelWarning />,
          modelSwitcher: <ComposerModelSwitcher />,
          modelSettings: agentId => <ComposerModelSettings agentId={agentId} />,
          speechInput: speechProps => <StudioSpeechInput {...speechProps} />,
          voiceCallPanel: <VoiceCallPanel voiceCall={voiceCall} />,
          voiceCallButton: <VoiceCallButton voiceCall={voiceCall} />,
        },
      }}
    >
      {children}
    </AgentChatFeaturesProvider>
  );
}

function StudioThreadBody(props: ThreadProps) {
  const messages = useChatMessages();
  const { data: mcpAppTools } = useMcpAppTools({ queryOptions: { enabled: messages.length > 0 } });
  return <BaseThread {...props} mcpAppTools={mcpAppTools} />;
}

/** Dictation, with the agent's request context from Studio's settings. */
const StudioSpeechInput = (props: { agentId?: string; onTranscript: (text: string) => void }) => {
  const [requestContext] = useEntityRequestContext('agent', props.agentId ?? '');
  return <SpeechInputButton {...props} requestContext={requestContext} />;
};
