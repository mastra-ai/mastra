import { Button } from '@mastra/playground-ui/components/Button';
import { Loader2, Mic, Square } from 'lucide-react';

import type { VoiceDictationState } from './useVoiceDictation';

const LABELS: Record<VoiceDictationState, string> = {
  idle: 'Dictate',
  requesting: 'Waiting for microphone…',
  recording: 'Stop dictation',
  transcribing: 'Transcribing…',
};

function VoiceIcon({ state }: { state: VoiceDictationState }) {
  if (state === 'recording') return <Square size={14} />;
  if (state === 'transcribing')
    return <Loader2 size={14} className="motion-safe:animate-spin motion-reduce:animate-none" />;
  return <Mic size={14} />;
}

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
  const recording = state === 'recording';
  // Stopping must always work, so a recording clip can be ended even after the composer locks.
  const blocked = state === 'requesting' || state === 'transcribing' || (disabled && !recording);
  return (
    <Button
      type="button"
      size="icon-sm"
      disabled={blocked}
      onClick={recording ? onStop : onStart}
      aria-label={LABELS[state]}
      aria-pressed={recording}
      tooltip={LABELS[state]}
      className={recording ? 'text-destructive' : undefined}
    >
      <VoiceIcon state={state} />
    </Button>
  );
}
