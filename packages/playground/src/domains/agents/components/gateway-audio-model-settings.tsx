import { Entry } from '@mastra/playground-ui/components/Entry';
import type { GatewayAudioModels } from '@mastra/playground-ui/utils/gateway-audio';

import type { GatewaySpeechSelection } from '@/lib/ai-ui/chat/gateway-audio-composer-actions';

interface GatewayAudioModelSettingsProps {
  models: GatewayAudioModels;
  transcriptionModel?: string;
  onTranscriptionModelChange: (modelId: string) => void;
  speechSelection: GatewaySpeechSelection;
  onSpeechSelectionChange: (selection: GatewaySpeechSelection) => void;
}

const fieldClass = 'text-body-sm w-full min-w-0 rounded-md border border-border bg-card px-2 py-1.5';

export function GatewayAudioModelSettings({
  models,
  transcriptionModel,
  onTranscriptionModelChange,
  speechSelection,
  onSpeechSelectionChange,
}: GatewayAudioModelSettingsProps) {
  const speechModel = models.speech.find(model => model.id === speechSelection.modelId) ?? models.speech[0];
  const voiceId =
    speechModel && speechSelection.modelId === speechModel.id
      ? speechSelection.voiceId || speechModel.voices[0] || ''
      : speechModel?.voices[0] || '';

  return (
    <>
      {transcriptionModel && (
        <Entry label="Transcription model">
          <select
            className={fieldClass}
            aria-label="Transcription model"
            value={transcriptionModel}
            onChange={event => onTranscriptionModelChange(event.target.value)}
          >
            {models.transcription.map(model => (
              <option key={model.id} value={model.id}>
                {model.id}
              </option>
            ))}
          </select>
        </Entry>
      )}
      {speechModel && (
        <>
          <Entry label="Speech model">
            <select
              className={fieldClass}
              aria-label="Speech model"
              value={speechModel.id}
              onChange={event => {
                const next = models.speech.find(model => model.id === event.target.value);
                if (next) onSpeechSelectionChange({ modelId: next.id, voiceId: next.voices[0] ?? '' });
              }}
            >
              {models.speech.map(model => (
                <option key={model.id} value={model.id}>
                  {model.id}
                </option>
              ))}
            </select>
          </Entry>
          <Entry label="Voice ID">
            <input
              className={fieldClass}
              aria-label="Voice ID"
              value={voiceId}
              onChange={event => onSpeechSelectionChange({ modelId: speechModel.id, voiceId: event.target.value })}
            />
          </Entry>
        </>
      )}
    </>
  );
}
