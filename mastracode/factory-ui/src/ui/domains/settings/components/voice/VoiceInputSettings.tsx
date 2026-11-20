import { SettingsContainer, SettingsSkeleton } from '@mastra/playground-ui/new/settings';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useGatewayAudioModels } from '@mastra/playground-ui/hooks/use-gateway-audio-models';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

import { useVoiceSettings } from '../../../../../hooks/use-voice-settings';
import { useApiConfig } from '../../../../../api/config';
import { VOICE_INPUT_ANCHOR } from '../../settingsSections';
import { SpeechToTextKeys, SpeechToTextKeysSkeleton } from './SpeechToTextKeys';
import { VoiceInputLayout } from './VoiceInputLayout';
import { VoiceModelSettings } from './VoiceModelSettings';

function SectionSkeleton() {
  return (
    <SettingsContainer>
      <SettingsSkeleton label="Loading voice input" rows={2} />
    </SettingsContainer>
  );
}

export function VoiceInputSettings({ factoryId }: { factoryId: string }) {
  const { baseUrl } = useApiConfig();
  const { data: gatewayAudio } = useGatewayAudioModels(baseUrl, Boolean(window.MASTRA_PLATFORM_PROJECT_ID));
  const gatewayModels = gatewayAudio?.transcription ?? [];
  const settingsQuery = useVoiceSettings(factoryId);
  const settings = settingsQuery.data;
  const { hash, key } = useLocation();
  const anchorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (hash === `#${VOICE_INPUT_ANCHOR}`) anchorRef.current?.scrollIntoView({ block: 'start' });
  }, [hash, key]);

  if (settingsQuery.error) {
    return (
      <VoiceInputLayout
        anchorRef={anchorRef}
        scope={undefined}
        models={
          <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
            {settingsQuery.error.message}
          </Txt>
        }
        keys={undefined}
      />
    );
  }

  if (!settings) {
    return (
      <VoiceInputLayout
        anchorRef={anchorRef}
        scope={undefined}
        models={<SectionSkeleton />}
        keys={<SpeechToTextKeysSkeleton />}
      />
    );
  }

  return (
    <VoiceInputLayout
      anchorRef={anchorRef}
      scope={settings.scope}
      models={<VoiceModelSettings factoryId={factoryId} settings={settings} gatewayModels={gatewayModels} />}
      keys={<SpeechToTextKeys keys={settings.keys} scope={settings.scope} />}
    />
  );
}
