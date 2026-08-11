import { Tab } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';

export type SignalsViewMode = 'flow' | 'compare' | 'lifelines';

export function ViewModeTab({ value, icon, label }: { value: SignalsViewMode; icon: React.ReactNode; label: string }) {
  return (
    <Tab value={value} className="px-3 py-2">
      <Icon size="sm">{icon}</Icon>
      <Txt variant="ui-sm" className="text-inherit">
        {label}
      </Txt>
    </Tab>
  );
}
