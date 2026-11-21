import { Button } from '@mastra/playground-ui/components/Button';
import { AgentChatFeaturesProvider, useAgentThreadInput } from '@mastra/playground-ui/domains/agents/chat';
import type { AgentChatThreadInput } from '@mastra/playground-ui/domains/agents/chat';
import { ChatMessagesLoadingSkeleton } from '@mastra/playground-ui/domains/agents/chat/agent-loading-skeletons';
import { Thread as BaseThread } from '@mastra/playground-ui/domains/agents/chat/thread';
import type { ThreadProps } from '@mastra/playground-ui/domains/agents/chat/thread';
import { useChatMessages } from '@mastra/playground-ui/domains/chat/context/chat-context';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { IconMicrophone } from '@mastra/playground-ui/icons/central/IconMicrophone';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { useSpeechRecognition } from '@mastra/react';
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
          speechInput: speechProps => <SpeechInput {...speechProps} />,
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

const SpeechInput = ({ agentId, onTranscript }: { agentId?: string; onTranscript: (text: string) => void }) => {
  const [requestContext] = useEntityRequestContext('agent', agentId ?? '');
  const { start, stop, isListening } = useSpeechRecognition({ agentId, requestContext });

  return (
    <Button
      variant="ghost"
      size="icon-md"
      type="button"
      tooltip={isListening ? 'Stop dictation' : 'Start dictation'}
      onClick={() => (isListening ? stop() : start(onTranscript))}
    >
      {isListening ? <CircleStopIcon /> : <IconMicrophone />}
    </Button>
  );
};

const CircleStopIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={quietTextHover}
    >
      <circle cx="12" cy="12" r="10" />
      <rect width="6" height="6" x="9" y="9" rx="1" />
    </svg>
  );
};
