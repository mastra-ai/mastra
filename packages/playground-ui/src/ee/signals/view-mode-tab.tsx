import { Tab } from '@/ds/components/Tabs';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';

export type SignalsViewMode = 'flow' | 'compare' | 'lifelines';

export function ViewModeTab({ value, icon, label }: { value: SignalsViewMode; icon: React.ReactNode; label: string }) {
  return (
    <Tab value={value}>
      <Icon size="xs">{icon}</Icon>
      <Txt variant="caption" className="text-inherit">
        {label}
      </Txt>
    </Tab>
  );
}
