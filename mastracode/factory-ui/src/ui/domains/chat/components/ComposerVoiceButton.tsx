import { Button } from '@mastra/playground-ui/components/Button';
import { Loader2, Mic, Square } from 'lucide-react';

import type { VoiceDictationState } from './useVoiceDictation';

const LABELS: Record<VoiceDictationState, string> = {
  idle: 'Dictate',
  recording: 'Stop dictation',
  transcribing: 'Transcribing…',
};

export function ComposerVoiceButton({
  state,
  disabled,
  onStart,
  onStop,
}: {
  state: VoiceDictationState;
  disabled: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      disabled={state === 'transcribing' || (disabled && state !== 'recording')}
      onClick={state === 'recording' ? onStop : onStart}
      aria-label={LABELS[state]}
      aria-pressed={state === 'recording'}
      tooltip={LABELS[state]}
      className={state === 'recording' ? 'text-destructive' : undefined}
    >
      {state === 'recording' ? (
        <Square size={14} />
      ) : state === 'transcribing' ? (
        <Loader2 size={14} className="motion-safe:animate-spin motion-reduce:animate-none" />
      ) : (
        <Mic size={14} />
      )}
    </Button>
  );
}
