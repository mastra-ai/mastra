import { Loader2, Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/ds/components/Button';

export type VoiceCallStatus = 'idle' | 'connecting' | 'active';
export interface VoiceCallButtonProps {
  status: VoiceCallStatus;
  available: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function VoiceCallButton({ status, available, onStart, onStop }: VoiceCallButtonProps) {
  if (status === 'idle')
    return (
      <Button
        variant="default"
        size="icon-md"
        type="button"
        aria-label="Start voice call"
        aria-disabled={!available || undefined}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        tooltip={available ? 'Start voice call' : 'Configure @mastra/livekit to start voice calls.'}
        data-testid="voice-call-button"
        onClick={available ? onStart : undefined}
      >
        <Phone className="text-neutral3 hover:text-neutral6 size-5" />
      </Button>
    );
  if (status === 'connecting')
    return (
      <Button variant="default" size="icon-md" type="button" tooltip="Connecting…" data-testid="voice-call-button">
        <Loader2 className="text-neutral3 size-5 motion-safe:animate-spin" />
      </Button>
    );
  return (
    <Button
      variant="default"
      size="icon-md"
      type="button"
      tooltip="End voice call"
      data-testid="voice-call-button"
      onClick={onStop}
    >
      <PhoneOff className="text-accent2 size-5" />
    </Button>
  );
}
