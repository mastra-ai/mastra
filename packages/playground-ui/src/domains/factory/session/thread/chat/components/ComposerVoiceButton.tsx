import { useVoiceSettings } from '@mastra/react/hooks/factory';
import { useSessionHost } from '../context/SessionHostContext';

import { VOICE_INPUT_ANCHOR } from '../services/sessionSettings';
import { voiceDictationSupported } from './useVoiceDictation';
import type { VoiceDictation, VoiceDictationState } from './useVoiceDictation';
import { Button } from '@/ds/components/Button';
import { IconMicrophone } from '@/ds/icons/central/IconMicrophone';
import { IconMicrophoneOff } from '@/ds/icons/central/IconMicrophoneOff';
import { IconStop } from '@/ds/icons/central/IconStop';

const TOOLTIPS: Record<VoiceDictationState, string> = {
  idle: 'Dictate',
  requesting: 'Waiting for microphone…',
  recording: 'Stop dictation',
  transcribing: 'Transcribing…',
};

interface ComposerVoiceButtonProps {
  factoryId: string;
  disabled: boolean;
  dictation: VoiceDictation;
}

function VoiceIcon({ state }: { state: VoiceDictationState }) {
  if (state === 'recording') return <IconStop className="size-icon-sm" />;
  return <IconMicrophone className="size-icon-sm" />;
}

function VoiceButton({ factoryId, disabled, dictation }: ComposerVoiceButtonProps) {
  const { navigate, links } = useSessionHost();
  const settingsQuery = useVoiceSettings(factoryId);
  const { state, start, stop } = dictation;
  const needsSetup = settingsQuery.data !== undefined && settingsQuery.data.effective === null;

  if (needsSetup && state === 'idle') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        tooltip="Set up voice input in settings"
        onClick={() => navigate(links.settings('models', VOICE_INPUT_ANCHOR), { returnHere: true })}
      >
        <IconMicrophoneOff />
      </Button>
    );
  }

  const recording = state === 'recording';
  // Stopping must always work, so a recording clip can be ended even after the composer locks.
  const blocked =
    state === 'requesting' || state === 'transcribing' || (!recording && (disabled || settingsQuery.isPending));
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={blocked}
      loading={state === 'transcribing'}
      onClick={recording ? stop : () => void start()}
      aria-label="Dictate"
      aria-pressed={recording}
      tooltip={TOOLTIPS[state]}
    >
      <VoiceIcon state={state} />
    </Button>
  );
}

export function ComposerVoiceButton(props: ComposerVoiceButtonProps) {
  if (!voiceDictationSupported()) return null;
  return <VoiceButton {...props} />;
}
