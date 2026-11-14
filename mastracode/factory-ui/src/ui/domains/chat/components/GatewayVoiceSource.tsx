import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SlidersHorizontal } from 'lucide-react';

interface GatewayVoiceSourceProps {
  models: readonly { id: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

export const CONFIGURED_VOICE_SOURCE = 'configured';

/** Keeps Factory's existing microphone compact while exposing its voice source choices. */
export function GatewayVoiceSource({ models, value, onChange, disabled }: GatewayVoiceSourceProps) {
  if (!models.length) return null;
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Voice input settings"
        tooltip="Voice input settings"
        disabled={disabled}
      >
        <SlidersHorizontal size={14} />
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-80" aria-label="Voice input settings">
        <Txt variant="body-sm">Voice input</Txt>
        <Txt variant="caption" tone="muted" className="mt-1">
          Mastra Gateway is the preferred connection.
        </Txt>
        <fieldset className="mt-3 grid max-h-64 gap-1 overflow-y-auto" disabled={disabled}>
          <legend className="sr-only">Voice input source</legend>
          {models.map(model => (
            <label key={model.id} className="hover:bg-muted flex items-start gap-2 rounded-md px-2 py-1.5">
              <input
                type="radio"
                name="voice-input-source"
                value={model.id}
                checked={value === model.id}
                onChange={() => onChange(model.id)}
                className="mt-0.5"
              />
              <Txt as="span" variant="caption" className="min-w-0 break-all">
                Mastra Gateway: {model.id}
              </Txt>
            </label>
          ))}
          <label className="hover:bg-muted flex items-start gap-2 rounded-md px-2 py-1.5">
            <input
              type="radio"
              name="voice-input-source"
              value={CONFIGURED_VOICE_SOURCE}
              checked={value === CONFIGURED_VOICE_SOURCE}
              onChange={() => onChange(CONFIGURED_VOICE_SOURCE)}
              className="mt-0.5"
            />
            <Txt as="span" variant="caption">
              Configured provider
            </Txt>
          </label>
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
