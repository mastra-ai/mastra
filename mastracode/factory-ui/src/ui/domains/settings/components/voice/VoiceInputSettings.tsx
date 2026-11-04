import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useVoiceSettings } from '../../../../../hooks/use-voice-settings';
import { useScrollToAnchor } from '../../hooks/useScrollToAnchor';
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
  useScrollToAnchor(VOICE_INPUT_ANCHOR, !settingsQuery.isPending);

  if (settingsQuery.error) {
    return (
      <VoiceInputLayout
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
    return <VoiceInputLayout scope={undefined} models={<SectionSkeleton />} keys={<ProviderRowsSkeleton />} />;
  }

  return (
    <VoiceInputLayout
      scope={settings.scope}
      models={<VoiceModelSettings factoryId={factoryId} settings={settings} />}
      keys={<SpeechToTextKeys keys={settings.keys} scope={settings.scope} />}
    />
  );
}
