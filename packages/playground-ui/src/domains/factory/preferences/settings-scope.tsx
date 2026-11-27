import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/ds/components/Badge';
import type { BadgeVariant } from '@/ds/components/Badge';
import { IconBuildings } from '@/ds/icons/central/IconBuildings';
import { IconServer } from '@/ds/icons/central/IconServer';
import { IconUser } from '@/ds/icons/central/IconUser';
import { IconUserDuo } from '@/ds/icons/central/IconUserDuo';

export type SettingsScope = 'personal' | 'factory' | 'org' | 'deployment';

const SCOPE_BADGE: Record<SettingsScope, { label: string; variant: BadgeVariant; icon: LucideIcon }> = {
  personal: { label: 'Personal', variant: 'neutral', icon: IconUser },
  factory: { label: 'Factory-wide', variant: 'blue', icon: IconBuildings },
  org: { label: 'Org-wide', variant: 'blue', icon: IconUserDuo },
  deployment: { label: 'Deployment-wide', variant: 'blue', icon: IconServer },
};

export function ScopeBadge({ scope }: { scope: SettingsScope }) {
  const { label, variant, icon: Icon } = SCOPE_BADGE[scope];
  return (
    <Badge size="sm" variant={variant} icon={<Icon aria-hidden="true" />}>
      {label}
    </Badge>
  );
}
