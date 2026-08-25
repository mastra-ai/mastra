import { Tab } from '@/ds/components/Tabs';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';

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
