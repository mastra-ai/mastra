import { Button } from '@mastra/playground-ui/components/Button';
import { Loader2, Phone, PhoneOff } from 'lucide-react';

import type { VoiceCallControls } from '../types';
export interface VoiceCallButtonProps {
  voiceCall: VoiceCallControls;
}

export function VoiceCallButton({ voiceCall }: VoiceCallButtonProps) {
  const { status, isLiveKitAvailable: available, start: onStart, stop: onStop } = voiceCall;
  if (status === 'idle')
    return (
      <Button
        variant="default"
        size="icon-md"
        type="button"
        aria-label="Start voice call"
        aria-disabled={!available || undefined}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        tooltip={available ? 'Speak with this agent' : 'Configure @mastra/livekit to start voice calls.'}
        data-testid="voice-call-button"
        onClick={available ? onStart : undefined}
      >
        <Phone className="text-neutral3 hover:text-neutral6 size-5" />
      </Button>
    );
  if (status === 'connecting')
    return (
      <Button
        variant="default"
        size="icon-md"
        type="button"
        aria-label="Connecting"
        tooltip="Voice call connection in progress"
        data-testid="voice-call-button"
      >
        <Loader2 className="text-neutral3 size-5 motion-safe:animate-spin" />
      </Button>
    );
  return (
    <Button
      variant="default"
      size="icon-md"
      type="button"
      aria-label="End voice call"
      tooltip="Stop the current voice call"
      data-testid="voice-call-button"
      onClick={onStop}
    >
      <PhoneOff className="text-accent2 size-5" />
    </Button>
  );
}
