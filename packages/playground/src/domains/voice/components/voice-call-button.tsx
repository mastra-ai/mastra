import { Button } from '@mastra/playground-ui/components/Button';
import { IconCall } from '@mastra/playground-ui/icons/central/IconCall';
import { IconCallCancel } from '@mastra/playground-ui/icons/central/IconCallCancel';
import { IconLoadingCircle } from '@mastra/playground-ui/icons/central/IconLoadingCircle';
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
        <IconCall />
      </Button>
    );
  }

  if (voiceCall.status === 'connecting') {
    return (
      <Button variant="ghost" size="icon-md" type="button" tooltip="Connecting…" data-testid="voice-call-button">
        <IconLoadingCircle className="animate-spin" />
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
      <IconCallCancel />
    </Button>
  );
};
