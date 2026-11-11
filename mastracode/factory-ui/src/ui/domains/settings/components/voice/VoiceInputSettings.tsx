import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

import { useVoiceSettings } from '../../../../../hooks/use-voice-settings';
import { VOICE_INPUT_ANCHOR } from '../../settingsSections';
import { ProviderRowsSkeleton } from '../models/providers/ProviderRows';
import { SpeechToTextKeys } from './SpeechToTextKeys';
import { VoiceInputLayout } from './VoiceInputLayout';
import { VoiceModelSettings } from './VoiceModelSettings';

function SectionSkeleton() {
  return <Skeleton className="h-32 w-full motion-reduce:before:animate-none" />;
}

export function VoiceInputSettings({ factoryId }: { factoryId: string }) {
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
        keys={<ProviderRowsSkeleton />}
      />
    );
  }

  return (
    <VoiceInputLayout
      anchorRef={anchorRef}
      scope={settings.scope}
      models={<VoiceModelSettings factoryId={factoryId} settings={settings} />}
      keys={<SpeechToTextKeys keys={settings.keys} scope={settings.scope} />}
    />
  );
}
