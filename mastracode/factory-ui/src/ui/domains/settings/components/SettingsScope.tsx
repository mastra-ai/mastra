import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import type { LucideIcon } from 'lucide-react';
import { IconBuildings } from '@mastra/playground-ui/icons/central/IconBuildings';
import { IconServer } from '@mastra/playground-ui/icons/central/IconServer';
import { IconCirclePerson } from '@mastra/playground-ui/icons/central/IconCirclePerson';
import { IconUserDuo } from '@mastra/playground-ui/icons/central/IconUserDuo';

export type SettingsScope = 'personal' | 'factory' | 'org' | 'deployment';

const SCOPE_BADGE: Record<SettingsScope, { label: string; variant: BadgeVariant; icon: LucideIcon }> = {
  personal: { label: 'Personal', variant: 'neutral', icon: IconCirclePerson },
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
