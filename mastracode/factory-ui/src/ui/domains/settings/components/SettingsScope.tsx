import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { Building2, CircleUserRound, Server, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type SettingsScope = 'personal' | 'factory' | 'org' | 'deployment';

const SCOPE_BADGE: Record<SettingsScope, { label: string; variant: BadgeVariant; icon: LucideIcon }> = {
  personal: { label: 'Personal', variant: 'neutral', icon: CircleUserRound },
  factory: { label: 'Factory-wide', variant: 'blue', icon: Building2 },
  org: { label: 'Org-wide', variant: 'blue', icon: Users },
  deployment: { label: 'Deployment-wide', variant: 'blue', icon: Server },
};

export function ScopeBadge({ scope }: { scope: SettingsScope }) {
  const { label, variant, icon: Icon } = SCOPE_BADGE[scope];
  return (
    <Badge size="sm" variant={variant} icon={<Icon aria-hidden="true" />}>
      {label}
    </Badge>
  );
}
