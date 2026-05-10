import { toAISdkV4Messages, toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { IconButton } from '@mastra/playground-ui';
import type { MastraUIMessage } from '@mastra/react';
import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAgentSettings } from '../context/agent-context';
import { AgentChatSettingsDialog } from './agent-chat-settings-dialog';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';
import { useAgentMessages } from '@/hooks/use-agent-messages';
import { Thread } from '@/lib/ai-ui/thread';

import { MastraRuntimeProvider } from '@/services/mastra-runtime-provider';
import type { ChatProps } from '@/types';

export const AgentChat = ({
  agentId,
  agentName,
  threadId,
  memory,
  refreshThreadList,
  modelVersion,
  agentVersionId,
  modelList,
  messageId,
  isNewThread,
  hideModelSwitcher,
}: Omit<ChatProps, 'initialMessages' | 'initialLegacyMessages'> & {
  messageId?: string;
  isNewThread?: boolean;
  hideModelSwitcher?: boolean;
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { settings } = useAgentSettings();
  const { settings: tracingSettings } = useTracingSettings();
  const requestContext = useMergedRequestContext();
  const hasSettingsOverride = Boolean(
    (settings?.modelSettings && Object.keys(settings.modelSettings).length > 0) ||
    (tracingSettings && Object.keys(tracingSettings).length > 0) ||
    (requestContext && Object.keys(requestContext).length > 0),
  );

  const { data, isLoading: isMessagesLoading } = useAgentMessages({
    agentId: agentId,
    threadId: isNewThread ? undefined : threadId!, // Prevent fetching when thread is new
    memory: memory ?? false,
  });

  // Handle scrolling to message after navigation
  useEffect(() => {
    if (messageId && data && !isMessagesLoading) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          messageElement.classList.add('bg-surface4');
          setTimeout(() => {
            messageElement.classList.remove('bg-surface4');
          }, 2000);
        }
      }, 100);
    }
  }, [messageId, data, isMessagesLoading]);

  // Stable empty array per thread: stays the same reference across re-renders
  // (preventing useChat from wiping streamed messages), but changes when threadId
  // changes (allowing useChat to reset when switching threads).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- changing this reference when threadId changes resets useChat state.
  const emptyMessages = useMemo(() => [] as never[], [threadId]);

  const messages = data?.messages ?? emptyMessages;
  const v5Messages = useMemo(() => toAISdkV5Messages(messages) as MastraUIMessage[], [messages]);
  const v4Messages = useMemo(() => toAISdkV4Messages(messages), [messages]);

  return (
    <MastraRuntimeProvider
      agentId={agentId}
      agentName={agentName}
      modelVersion={modelVersion}
      agentVersionId={agentVersionId}
      threadId={threadId}
      initialMessages={v5Messages}
      initialLegacyMessages={v4Messages}
      memory={memory}
      refreshThreadList={refreshThreadList}
      settings={settings}
      requestContext={requestContext}
    >
      <Thread
        agentName={agentName ?? ''}
        hasMemory={memory}
        agentId={agentId}
        threadId={threadId}
        hasModelList={Boolean(modelList)}
        hideModelSwitcher={hideModelSwitcher}
        composerControls={
          <IconButton
            tooltip={hasSettingsOverride ? 'Chat Settings (overridden)' : 'Chat Settings'}
            size="sm"
            variant={hasSettingsOverride ? 'outline' : 'ghost'}
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Chat Settings"
          >
            <SlidersHorizontal />
          </IconButton>
        }
      />
      <AgentChatSettingsDialog agentId={agentId} open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </MastraRuntimeProvider>
  );
};
