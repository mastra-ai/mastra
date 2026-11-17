import { VoiceInputSettings } from '../voice/VoiceInputSettings';
import { ModelRoutingSection } from './routing/ModelRoutingSection';

export function ModelsSettings({ factoryId }: { factoryId: string }) {
  return (
    <>
      <ModelRoutingSection factoryId={factoryId} />
      <VoiceInputSettings factoryId={factoryId} />
    </>
  );
}
