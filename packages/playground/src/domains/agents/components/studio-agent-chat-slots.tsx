import { AgentChatSlotsProvider } from '@mastra/playground-ui/domains/agent-chat/context/agent-chat-slots';
import type { AgentChatSlots } from '@mastra/playground-ui/domains/agent-chat/context/agent-chat-slots';
import { ComposerModelSettings } from '@mastra/playground-ui/domains/agent-chat/model/composer-model-settings';
import {
  ComposerModelSwitcher,
  ComposerModelWarning,
} from '@mastra/playground-ui/domains/agent-chat/model/composer-model-switcher';
import type { ReactNode } from 'react';
import { studioOverviewSlots } from './studio-overview-slots';
import { AgentCapabilitiesFooter } from '@/domains/agents/components/memory-sidebar/agent-capabilities-footer';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useVoiceCall, VoiceCallButton, VoiceCallPanel } from '@/domains/voice';

const voice: AgentChatSlots['voice'] = {
  useVoiceCall: ({ agentId, threadId, onCallStarted }) => useVoiceCall({ agentId, threadId, onCallStarted }),
  VoiceCallButton,
  VoiceCallPanel,
};

/** Wires Studio's permissions, model switching, voice and sidebar footer into the shared agent chat. */
export const StudioAgentChatSlots = ({ children }: { children: ReactNode }) => {
  const { canExecute, canEdit, canDelete } = usePermissions();
  return (
    <AgentChatSlotsProvider
      slots={{
        canExecute,
        canEdit,
        canDelete,
        SidebarFooter: AgentCapabilitiesFooter,
        ModelSwitcher: ComposerModelSwitcher,
        ModelWarning: ComposerModelWarning,
        ModelSettings: ComposerModelSettings,
        voice,
        ...studioOverviewSlots,
      }}
    >
      {children}
    </AgentChatSlotsProvider>
  );
};
