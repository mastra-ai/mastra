import type { GetAgentResponse } from '@mastra/client-js';
import { createContext, useContext } from 'react';
import type { ComponentType, ReactNode } from 'react';

export type VoiceCallStatus = 'idle' | 'connecting' | 'active';
export type VoiceAgentState = 'initializing' | 'listening' | 'thinking' | 'speaking';

export interface VoiceCaptionSegment {
  id: string;
  role: 'user' | 'agent';
  text: string;
  final: boolean;
}

export interface VoiceCallControls {
  status: VoiceCallStatus;
  agentState: VoiceAgentState;
  captions: VoiceCaptionSegment[];
  isLiveKitAvailable: boolean;
  start: () => void;
  stop: () => void;
}

/**
 * Host-specific pieces of the agent chat. Studio and Platform each supply their own
 * permissions, model switching and voice; anything left out is hidden.
 */
export interface AgentChatSlots {
  /** Defaults to allowing everything. */
  canExecute?: (resource: string) => boolean;
  canEdit?: (resource: string) => boolean;
  canDelete?: (resource: string) => boolean;
  /** Rendered at the bottom of the memory sidebar. */
  SidebarFooter?: ComponentType<{ agentId: string }>;
  /** Overrides the overview Models list, e.g. when an editor form owns the model. Render `fallback` to keep the default. */
  OverviewModelList?: ComponentType<{
    agentId: string;
    modelList: NonNullable<GetAgentResponse['modelList']>;
    editable: boolean;
    fallback: ReactNode;
  }>;
  OverviewModelsActions?: ComponentType;
  OverviewChannels?: ComponentType<{ agentId: string }>;
  SystemPromptNotice?: ComponentType;
  ModelSwitcher?: ComponentType;
  ModelWarning?: ComponentType;
  ModelSettings?: ComponentType<{ agentId: string }>;
  voice?: {
    useVoiceCall: (opts: {
      agentId?: string;
      threadId?: string;
      onCallStarted?: () => void;
    }) => VoiceCallControls | undefined;
    VoiceCallButton: ComponentType<{ voiceCall: VoiceCallControls }>;
    VoiceCallPanel: ComponentType<{ voiceCall: VoiceCallControls }>;
  };
}

const allow = () => true;
const noVoice = () => undefined;

const AgentChatSlotsContext = createContext<AgentChatSlots>({});

export const AgentChatSlotsProvider = ({ slots, children }: { slots: AgentChatSlots; children: ReactNode }) => (
  <AgentChatSlotsContext.Provider value={slots}>{children}</AgentChatSlotsContext.Provider>
);

export const useAgentChatSlots = () => {
  const slots = useContext(AgentChatSlotsContext);
  return {
    ...slots,
    canExecute: slots.canExecute ?? allow,
    canEdit: slots.canEdit ?? allow,
    canDelete: slots.canDelete ?? allow,
    useVoiceCall: slots.voice?.useVoiceCall ?? noVoice,
  };
};
