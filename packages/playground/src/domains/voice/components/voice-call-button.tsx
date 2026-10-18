import { Button } from '@mastra/playground-ui/components/Button';
import { Loader2, Phone, PhoneOff } from 'lucide-react';
import type { VoiceCallControls } from '../types';

export interface VoiceCallButtonProps {
  voiceCall: VoiceCallControls;
}

export const VoiceCallButton = ({ voiceCall }: VoiceCallButtonProps) => {
  const { isLiveKitAvailable } = voiceCall;

  if (voiceCall.status === 'idle') {
    return (
      <Button
        variant="ghost"
        size="icon-md"
        type="button"
        aria-label="Start voice call"
        aria-disabled={!isLiveKitAvailable || undefined}
        tooltip={isLiveKitAvailable ? 'Start voice call' : 'Configure @mastra/livekit to start voice calls.'}
        data-testid="voice-call-button"
        onClick={() => voiceCall.start()}
      >
        <Phone />
      </Button>
    );
  }

  if (voiceCall.status === 'connecting') {
    return (
      <Button variant="ghost" size="icon-md" type="button" tooltip="Connecting…" data-testid="voice-call-button">
        <Loader2 className="animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      variant="destructive-ghost"
      size="icon-md"
      type="button"
      tooltip="End voice call"
      data-testid="voice-call-button"
      onClick={() => voiceCall.stop()}
    >
      <PhoneOff />
    </Button>
  );
};
