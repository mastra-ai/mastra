import { VoiceCallButton as VoiceCallButtonView } from '@mastra/playground-ui/components/ai/voice-call';
import type { VoiceCallControls } from '../types';

export interface VoiceCallButtonProps {
  voiceCall: VoiceCallControls;
}

export const VoiceCallButton = ({ voiceCall }: VoiceCallButtonProps) => (
  <VoiceCallButtonView
    status={voiceCall.status}
    available={voiceCall.isLiveKitAvailable}
    onStart={voiceCall.start}
    onStop={voiceCall.stop}
  />
);
