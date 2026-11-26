import { Button } from '@/ds/components/Button';
import { IconMicrophone } from '@/ds/icons/central/IconMicrophone';
import { IconStopCircle } from '@/ds/icons/central/IconStopCircle';

export interface SpeechInputButtonProps {
  isListening: boolean;
  onStart: () => void;
  onStop: () => void;
}

/**
 * Dictation for the chat composer, for the `speechInput` slot of `AgentChatFeaturesProvider`. The host runs the
 * recognition (e.g. `useSpeechRecognition` from `@mastra/react`) and passes its state in.
 */
export function SpeechInputButton({ isListening, onStart, onStop }: SpeechInputButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon-md"
      type="button"
      tooltip={isListening ? 'Stop dictation' : 'Start dictation'}
      onClick={isListening ? onStop : onStart}
    >
      {isListening ? <IconStopCircle /> : <IconMicrophone />}
    </Button>
  );
}
