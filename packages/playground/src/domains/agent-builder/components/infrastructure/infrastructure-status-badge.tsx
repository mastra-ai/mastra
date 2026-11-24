import { Badge } from '@mastra/playground-ui/components/Badge';

export interface InfrastructureStatusBadgeProps {
  ok: boolean;
  label: string;
}

export const InfrastructureStatusBadge = ({ ok, label }: InfrastructureStatusBadgeProps) => (
  <Badge
    variant={ok ? 'success' : 'neutral'}
    size="sm"
    indicator="dot"
    data-slot="infrastructure-status-badge"
    data-ok={ok ? 'true' : 'false'}
  >
    {label}
  </Badge>
);
