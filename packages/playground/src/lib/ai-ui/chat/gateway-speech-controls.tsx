import { Button } from '@mastra/playground-ui/components/Button';
import type { GatewayAudioModels } from '@mastra/playground-ui/utils/gateway-audio';
import { Square, Volume2 } from 'lucide-react';

export interface GatewaySpeechSelection {
  modelId: string;
  voiceId: string;
}

interface GatewaySpeechControlsProps {
  models: GatewayAudioModels['speech'];
  selection: GatewaySpeechSelection;
  onSelectionChange: (selection: GatewaySpeechSelection) => void;
  playback: { hasText: boolean; isSpeaking: boolean; read: () => void; stop: () => void };
}

export function GatewaySpeechControls({ models, selection, onSelectionChange, playback }: GatewaySpeechControlsProps) {
  const selected = models.find(model => model.id === selection.modelId) ?? models[0];
  if (!selected) return null;
  const voiceId =
    selection.modelId === selected.id ? selection.voiceId || selected.voices[0] || '' : selected.voices[0] || '';

  return (
    <div className="flex items-center gap-2" aria-label="Gateway speech settings">
      <select
        aria-label="Speech model"
        className="max-w-28"
        value={selected.id}
        onChange={event => {
          const next = models.find(model => model.id === event.target.value);
          if (next) onSelectionChange({ modelId: next.id, voiceId: next.voices[0] ?? '' });
        }}
      >
        {models.map(model => (
          <option key={model.id} value={model.id}>
            {model.id}
          </option>
        ))}
      </select>
      <input
        aria-label="Gateway voice ID"
        placeholder="Voice ID"
        value={voiceId}
        onChange={event => onSelectionChange({ modelId: selected.id, voiceId: event.target.value })}
        className="w-20"
      />
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
    </div>
  );
}
