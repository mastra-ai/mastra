import { Button } from '@mastra/playground-ui/components/Button';
import { Loader2, Phone, PhoneOff } from 'lucide-react';
import type { VoiceCallControls } from '../types';
import { useMastraPackages } from '@/domains/configuration/hooks/use-mastra-packages';

export interface VoiceCallButtonProps {
  voiceCall: VoiceCallControls;
}

export const VoiceCallButton = ({ voiceCall }: VoiceCallButtonProps) => {
  const { data: systemPackages } = useMastraPackages();
  const liveKitUnavailable = systemPackages?.liveKitConnectionRouteEnabled === false;

  if (voiceCall.status === 'idle') {
    return (
      <Button
        variant="default"
        size="icon-md"
        type="button"
        aria-label="Start voice call"
        disabled={liveKitUnavailable}
        focusableWhenDisabled={liveKitUnavailable}
        tooltip={liveKitUnavailable ? 'Configure @mastra/livekit to start voice calls.' : 'Start voice call'}
        data-testid="voice-call-button"
        onClick={() => voiceCall.start()}
      >
        <Phone className="h-5 w-5 text-neutral3 hover:text-neutral6" />
      </Button>
    );
  }

  if (voiceCall.status === 'connecting') {
    return (
      <Button variant="default" size="icon-md" type="button" tooltip="Connecting…" data-testid="voice-call-button">
        <Loader2 className="h-5 w-5 text-neutral3 animate-spin" />
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
