interface GatewayVoiceSourceProps {
  models: readonly { id: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

export const CONFIGURED_VOICE_SOURCE = 'configured';

/** A source choice beside Factory's existing microphone control. */
export function GatewayVoiceSource({ models, value, onChange, disabled }: GatewayVoiceSourceProps) {
  if (!models.length) return null;
  return (
    <select
      aria-label="Voice input source"
      title="Mastra Gateway is the preferred speech-to-text connection"
      className="max-w-36 text-xs"
      value={value}
      disabled={disabled}
      onChange={event => onChange(event.target.value)}
    >
      {models.map(model => (
        <option key={model.id} value={model.id}>
          Mastra Gateway (preferred): {model.id}
        </option>
      ))}
      <option value={CONFIGURED_VOICE_SOURCE}>Configured provider</option>
    </select>
  );
}
