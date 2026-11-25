import { AgentChat as SharedAgentChat } from '@mastra/playground-ui/domains/agents/chat/agent-chat';
import type { AgentChatProps } from '@mastra/playground-ui/domains/agents/chat/agent-chat';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useAgentSettings } from '../context/agent-context';
import { StudioRuntimeFeatures } from '@/lib/ai-ui/chat/chat-provider';
import { StudioComposerFeatures } from '@/lib/ai-ui/thread';

export function AgentChat(
  props: Omit<AgentChatProps, 'requestContext' | 'settings' | 'RuntimeFeatures' | 'ComposerFeatures'>,
) {
  const { settings } = useAgentSettings();
  const requestContext = useEntityRequestContext('agent', props.agentId)[0];

  return (
    <SharedAgentChat
      {...props}
      settings={settings}
      requestContext={requestContext}
      RuntimeFeatures={StudioRuntimeFeatures}
      ComposerFeatures={StudioComposerFeatures}
    />
  );
}
