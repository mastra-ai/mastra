import { AudioLinesIcon, StopCircleIcon } from 'lucide-react';
import { ProviderLogo } from '@/domains/llm';
import { Button } from '@/ds/components/Button';
import { MessageCopyButton, MessageMetadata } from '@/ds/components/Message';

export function AssistantMessageActions({
  text,
  modelMetadata,
  isSpeaking,
  onReadAloud,
  onStopSpeaking,
}: {
  text: string;
  modelMetadata?: { modelId: string; modelProvider: string };
  isSpeaking?: boolean;
  onReadAloud?: (text: string) => void;
  onStopSpeaking?: () => void;
}) {
  return (
    <>
      {modelMetadata && (
        <MessageMetadata>
          <ProviderLogo providerId={modelMetadata.modelProvider} size={14} />
          <span>
            {modelMetadata.modelProvider}/{modelMetadata.modelId}
          </span>
        </MessageMetadata>
      )}
      {(onReadAloud || onStopSpeaking) &&
        (isSpeaking ? (
          <Button variant="ghost" size="icon-sm" tooltip="Stop" aria-label="Stop" onClick={() => onStopSpeaking?.()}>
            <StopCircleIcon />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            tooltip="Read aloud"
            aria-label="Read aloud"
            onClick={() => onReadAloud?.(text)}
          >
            <AudioLinesIcon />
          </Button>
        ))}
      <MessageCopyButton text={text} />
    </>
  );
}
