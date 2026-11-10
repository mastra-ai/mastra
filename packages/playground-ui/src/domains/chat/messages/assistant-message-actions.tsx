import { ProviderLogo } from '@/domains/llm';
import { Button } from '@/ds/components/Button';
import { MessageCopyButton, MessageMetadata } from '@/ds/components/Message';
import { IconStopCircle } from '@/ds/icons/central/IconStopCircle';
import { IconVoiceHigh } from '@/ds/icons/central/IconVoiceHigh';

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
            <IconStopCircle />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            tooltip="Read aloud"
            aria-label="Read aloud"
            onClick={() => onReadAloud?.(text)}
          >
            <IconVoiceHigh />
          </Button>
        ))}
      <MessageCopyButton text={text} />
    </>
  );
}
