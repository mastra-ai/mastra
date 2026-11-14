import { Button } from '@mastra/playground-ui/components/Button';
import { GatewayDictation } from '@mastra/playground-ui/components/GatewayDictation';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { GatewayAudioModels } from '@mastra/playground-ui/utils/gateway-audio';
import { SlidersHorizontal, Square, Volume2 } from 'lucide-react';
import { useState } from 'react';

export interface GatewaySpeechSelection {
  modelId: string;
  voiceId: string;
}

interface GatewayAudioComposerActionsProps {
  baseUrl: string;
  models: GatewayAudioModels;
  onTranscript: (text: string) => void;
  speechSelection: GatewaySpeechSelection;
  onSpeechSelectionChange: (selection: GatewaySpeechSelection) => void;
  playback: { hasText: boolean; isSpeaking: boolean; read: () => void; stop: () => void };
}

const fieldClass = 'text-body-sm w-full min-w-0 rounded-md border border-border bg-card px-2 py-1.5';

/** Keeps recording and playback actions compact; model choices live in one menu. */
export function GatewayAudioComposerActions({
  baseUrl,
  models,
  onTranscript,
  speechSelection,
  onSpeechSelectionChange,
  playback,
}: GatewayAudioComposerActionsProps) {
  const [transcriptionModelId, setTranscriptionModelId] = useState('');
  const transcriptionModel =
    models.transcription.find(model => model.id === transcriptionModelId)?.id ?? models.transcription[0]?.id;
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
      <Popover>
        <PopoverTrigger
          type="button"
          variant="ghost"
          size="icon-md"
          aria-label="Voice settings"
          tooltip="Voice settings"
        >
          <SlidersHorizontal size={16} />
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-80 space-y-4" aria-label="Gateway voice settings">
          <Txt variant="body-sm">Gateway voice settings</Txt>
          {transcriptionModel && (
            <label className="grid gap-1">
              <Txt as="span" variant="caption">
                Transcription model
              </Txt>
              <select
                className={fieldClass}
                value={transcriptionModel}
                onChange={event => setTranscriptionModelId(event.target.value)}
              >
                {models.transcription.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          {speechModel && (
            <>
              <label className="grid gap-1">
                <Txt as="span" variant="caption">
                  Speech model
                </Txt>
                <select
                  className={fieldClass}
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
              </label>
              <label className="grid gap-1">
                <Txt as="span" variant="caption">
                  Voice ID
                </Txt>
                <input
                  className={fieldClass}
                  value={voiceId}
                  placeholder="Voice ID"
                  onChange={event => onSpeechSelectionChange({ modelId: speechModel.id, voiceId: event.target.value })}
                />
              </label>
            </>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
