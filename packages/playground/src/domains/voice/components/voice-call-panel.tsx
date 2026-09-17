import { VoiceCallPanel as VoiceCallPanelView } from '@mastra/playground-ui/components/ai/voice-call';
import type { VoiceCallControls } from '../types';

export interface VoiceCallPanelProps {
  voiceCall: VoiceCallControls;
}

export const VoiceCallPanel = ({ voiceCall }: VoiceCallPanelProps) => (
  <VoiceCallPanelView status={voiceCall.status} agentState={voiceCall.agentState} captions={voiceCall.captions} />
);
