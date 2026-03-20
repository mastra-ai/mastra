import { Thread } from '@/lib/ai-ui/thread';

import { MastraRuntimeProvider } from '@/services/mastra-runtime-provider';
import { ChatProps } from '@/types';
import { useAgentSettings } from '../context/agent-context';
import { useAgentMessages } from '@/hooks/use-agent-messages';
import { MastraUIMessage } from '@mastra/react';
import { useEffect, useMemo, useState } from 'react';
import { toAISdkV4Messages, toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';
import { IconButton } from '@/ds/components/IconButton';
import { SlidersHorizontal } from 'lucide-react';
import { AgentChatSettingsDialog } from './agent-chat-settings-dialog';
import { useAgent } from '../hooks/use-agent';
import { defaultSettings as fallbackAgentSettings } from '../hooks/use-agent-settings-state';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';
import { cn } from '@/lib/utils';

export const AgentChat = ({
  agentId,
  agentName,
  threadId,
  memory,
  refreshThreadList,
  modelVersion,
  modelList,
  messageId,
  isNewThread,
  hideModelSwitcher,
}: Omit<ChatProps, 'initialMessages' | 'initialLegacyMessages'> & {
  messageId?: string;
  isNewThread?: boolean;
  hideModelSwitcher?: boolean;
}) => {
  const { settings } = useAgentSettings();
  const { data: agent } = useAgent(agentId);
  const { settings: tracingSettings } = useTracingSettings();
  const requestContext = useMergedRequestContext();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const hasSettingsOverride = useMemo(() => {
    if (!agent) {
      return false;
    }

    const defaultModelSettings = {
      ...fallbackAgentSettings.modelSettings,
      ...(agent.defaultOptions ?? {}),
    };

    const currentModelSettings = {
      ...defaultModelSettings,
      ...(settings?.modelSettings ?? {}),
    };

    const hasModelOverrides = JSON.stringify(currentModelSettings) !== JSON.stringify(defaultModelSettings);
    const hasTracingOverrides = Boolean(tracingSettings?.tracingOptions);
    const hasRequestContextOverrides = Object.keys(requestContext ?? {}).length > 0;

    return hasModelOverrides || hasTracingOverrides || hasRequestContextOverrides;
  }, [agent, requestContext, settings?.modelSettings, tracingSettings?.tracingOptions]);

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
  const emptyMessages = useMemo(() => [] as never[], [threadId]);

  const messages = data?.messages ?? emptyMessages;
  const v5Messages = useMemo(() => toAISdkV5Messages(messages) as MastraUIMessage[], [messages]);
  const v4Messages = useMemo(() => toAISdkV4Messages(messages), [messages]);

  return (
    <MastraRuntimeProvider
      agentId={agentId}
      agentName={agentName}
      modelVersion={modelVersion}
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
        hasModelList={Boolean(modelList)}
        hideModelSwitcher={hideModelSwitcher}
        composerControls={
          <IconButton
            tooltip={hasSettingsOverride ? 'Chat Settings (overridden)' : 'Chat Settings'}
            size="sm"
            variant="outline"
            className={cn(hasSettingsOverride && 'border-accent1 text-accent1 hover:border-accent1 hover:text-accent1')}
            onClick={() => setIsSettingsOpen(true)}
            data-testid="chat-settings-button"
            data-has-overrides={hasSettingsOverride}
          >
            <SlidersHorizontal className={cn(hasSettingsOverride && 'text-accent1')} />
          </IconButton>
        }
      />
      <AgentChatSettingsDialog agentId={agentId} open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </MastraRuntimeProvider>
  );
};
