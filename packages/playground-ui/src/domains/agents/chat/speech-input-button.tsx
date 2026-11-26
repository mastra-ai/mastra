import { useSpeechRecognition } from '@mastra/react';
import { Button } from '@/ds/components/Button';
import { IconMicrophone } from '@/ds/icons/central/IconMicrophone';
import { IconStopCircle } from '@/ds/icons/central/IconStopCircle';

export interface SpeechInputButtonProps {
  agentId?: string;
  requestContext?: Parameters<typeof useSpeechRecognition>[0]['requestContext'];
  onTranscript: (text: string) => void;
}

/** Dictation for the chat composer: the `speechInput` slot of `AgentChatFeaturesProvider`. */
export function SpeechInputButton({ agentId, requestContext, onTranscript }: SpeechInputButtonProps) {
  const { start, stop, isListening } = useSpeechRecognition({ agentId, requestContext });
  return (
    <Button
      variant="ghost"
      size="icon-md"
      type="button"
      tooltip={isListening ? 'Stop dictation' : 'Start dictation'}
      onClick={() => (isListening ? stop() : start(onTranscript))}
    >
      {isListening ? <IconStopCircle /> : <IconMicrophone />}
    </Button>
  );
}
