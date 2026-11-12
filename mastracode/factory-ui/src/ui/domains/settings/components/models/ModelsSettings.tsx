import { VoiceInputSettings } from '../voice/VoiceInputSettings';
import { ModelRoutingSection } from './routing/ModelRoutingSection';

export function ModelsSettings({ factoryId }: { factoryId: string }) {
  return (
    <div className="flex flex-col gap-8">
      <ModelRoutingSection factoryId={factoryId} />
      <VoiceInputSettings factoryId={factoryId} />
    </div>
  );
}
