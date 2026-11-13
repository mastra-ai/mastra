import { Button } from '@mastra/playground-ui/components/Button';
import { Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

import { useVoiceSettings } from '../../../../hooks/use-voice-settings';
import { VOICE_INPUT_ANCHOR, settingsSectionPath } from '../../settings/settingsSections';
import { voiceDictationSupported } from './useVoiceDictation';
import type { VoiceDictation, VoiceDictationState } from './useVoiceDictation';
import { IconMicrophone } from '@mastra/playground-ui/icons/central/IconMicrophone';
import { IconMicrophoneOff } from '@mastra/playground-ui/icons/central/IconMicrophoneOff';
import { IconStop } from '@mastra/playground-ui/icons/central/IconStop';

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
  if (state === 'recording') return <IconStop size={14} />;
  if (state === 'transcribing')
    return <Loader2 size={14} className="motion-safe:animate-spin motion-reduce:animate-none" />;
  return <IconMicrophone size={14} />;
}

function VoiceButton({ factoryId, disabled, dictation }: ComposerVoiceButtonProps) {
  const location = useLocation();
  const navigate = useNavigate();
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
        onClick={() =>
          navigate(settingsSectionPath(factoryId, 'models', VOICE_INPUT_ANCHOR), { state: { from: location } })
        }
      >
        <IconMicrophoneOff size={14} />
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
