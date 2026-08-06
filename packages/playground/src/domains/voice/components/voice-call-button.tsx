import { Button } from '@mastra/playground-ui/components/Button';
import { Loader2, Phone, PhoneOff } from 'lucide-react';
import type { VoiceCallControls } from '../types';

export interface VoiceCallButtonProps {
  voiceCall: VoiceCallControls;
}

export const VoiceCallButton = ({ voiceCall }: VoiceCallButtonProps) => {
  if (voiceCall.status === 'idle') {
    return (
      <Button
        variant="default"
        size="icon-md"
        type="button"
        tooltip="Start voice call"
        data-testid="voice-call-button"
        onClick={() => voiceCall.start()}
      >
        <Phone className="text-neutral3 hover:text-neutral6 h-5 w-5" />
      </Button>
    );
  }

  if (voiceCall.status === 'connecting') {
    return (
      <Button variant="default" size="icon-md" type="button" tooltip="Connecting…" data-testid="voice-call-button">
        <Loader2 className="text-neutral3 h-5 w-5 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      variant="default"
      size="icon-md"
      type="button"
      tooltip="End voice call"
      data-testid="voice-call-button"
      onClick={() => voiceCall.stop()}
    >
      <PhoneOff className="h-5 w-5 text-red-500" />
    </Button>
  );
};
