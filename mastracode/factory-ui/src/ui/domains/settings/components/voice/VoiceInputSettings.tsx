import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useVoiceSettings } from '../../../../../hooks/use-voice-settings';
import { useScrollToAnchor } from '../../hooks/useScrollToAnchor';
import { VOICE_INPUT_ANCHOR } from '../../settingsSections';
import { ProviderRowsSkeleton } from '../models/providers/ProviderRows';
import { voiceKeyScope } from './key-scope';
import { SpeechToTextKeys } from './SpeechToTextKeys';
import { VoiceInputLayout } from './VoiceInputLayout';
import { VoiceModelSettings } from './VoiceModelSettings';

function SectionSkeleton() {
  return <Skeleton className="h-32 w-full motion-reduce:before:animate-none" />;
}

/**
 * Speech-to-text for the composer mic and Slack voice clips. The Factory's
 * model scope decides which choice and key apply: `factory` uses the Factory
 * model with organization keys, `user` uses each member's choice and personal
 * keys, `hybrid` tries the personal choice and key first.
 */
export function VoiceInputSettings({ factoryId }: { factoryId: string }) {
  const settingsQuery = useVoiceSettings(factoryId);
  const settings = settingsQuery.data;
  useScrollToAnchor(VOICE_INPUT_ANCHOR, !settingsQuery.isPending);

  if (settingsQuery.error) {
    return (
      <VoiceInputLayout
        keysScope="personal"
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
    return <VoiceInputLayout keysScope="personal" models={<SectionSkeleton />} keys={<ProviderRowsSkeleton />} />;
  }

  const keyScope = voiceKeyScope(settings.modelScope);
  return (
    <VoiceInputLayout
      keysScope={keyScope === 'org' ? 'org' : 'personal'}
      models={<VoiceModelSettings factoryId={factoryId} settings={settings} />}
      keys={<SpeechToTextKeys keys={settings.keys} keyScope={keyScope} />}
    />
  );
}
