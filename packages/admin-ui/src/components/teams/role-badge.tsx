import { Badge } from '@/components/ui/badge';
import { TeamRole } from '@/types/api';

const roleConfig: Record<TeamRole, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  [TeamRole.OWNER]: { label: 'Owner', variant: 'default' },
  [TeamRole.ADMIN]: { label: 'Admin', variant: 'default' },
  [TeamRole.DEVELOPER]: { label: 'Developer', variant: 'secondary' },
  [TeamRole.VIEWER]: { label: 'Viewer', variant: 'outline' },
};

interface RoleBadgeProps {
  role: TeamRole;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const config = roleConfig[role];
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
