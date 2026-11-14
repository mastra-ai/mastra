import { Button } from '@mastra/playground-ui/components/Button';
import { GatewayDictation } from '@mastra/playground-ui/components/GatewayDictation';
import type { GatewayAudioModels } from '@mastra/playground-ui/utils/gateway-audio';
import { Square, Volume2 } from 'lucide-react';

export interface GatewaySpeechSelection {
  modelId: string;
  voiceId: string;
}

interface GatewayAudioComposerActionsProps {
  baseUrl: string;
  models: GatewayAudioModels;
  onTranscript: (text: string) => void;
  transcriptionModel?: string;
  speechSelection: GatewaySpeechSelection;
  playback: { hasText: boolean; isSpeaking: boolean; read: () => void; stop: () => void };
}

/** Recording and playback actions use the models chosen in Model settings. */
export function GatewayAudioComposerActions({
  baseUrl,
  models,
  onTranscript,
  transcriptionModel,
  speechSelection,
  playback,
}: GatewayAudioComposerActionsProps) {
  const speechModel = models.speech.find(model => model.id === speechSelection.modelId) ?? models.speech[0];
  const defaultVoiceId = speechModel?.voices[0] ?? '';
  const voiceId =
    speechModel && speechSelection.modelId === speechModel.id
      ? speechSelection.voiceId || defaultVoiceId
      : defaultVoiceId;

  if (!transcriptionModel && !speechModel) return null;

  return (
    <>
      <GatewayDictation baseUrl={baseUrl} model={transcriptionModel} onTranscript={onTranscript} />
      {speechModel && (
        <Button
          type="button"
          variant="ghost"
          size="icon-md"
          tooltip={playback.isSpeaking ? 'Stop reading aloud' : 'Read latest reply aloud'}
          disabled={!playback.hasText || !voiceId}
          onClick={playback.isSpeaking ? playback.stop : playback.read}
        >
          {playback.isSpeaking ? <Square size={16} /> : <Volume2 size={16} />}
        </Button>
      )}
    </>
  );
}
