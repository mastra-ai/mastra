import { Badge } from '@/components/ui/badge';
import { Circle, Loader2, CheckCircle2, XCircle, StopCircle } from 'lucide-react';
import { DeploymentStatus } from '@/types/api';
import { cn } from '@/lib/utils';

const statusConfig: Record<
  DeploymentStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  [DeploymentStatus.PENDING]: { label: 'Pending', variant: 'secondary', icon: Circle },
  [DeploymentStatus.BUILDING]: { label: 'Building', variant: 'warning', icon: Loader2 },
  [DeploymentStatus.RUNNING]: { label: 'Running', variant: 'success', icon: CheckCircle2 },
  [DeploymentStatus.STOPPED]: { label: 'Stopped', variant: 'outline', icon: StopCircle },
  [DeploymentStatus.FAILED]: { label: 'Failed', variant: 'destructive', icon: XCircle },
};

interface DeploymentStatusBadgeProps {
  status: DeploymentStatus;
  className?: string;
}

export function DeploymentStatusBadge({ status, className }: DeploymentStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isAnimated = status === DeploymentStatus.BUILDING;

  return (
    <Badge variant={config.variant} className={cn('flex items-center gap-1.5', className)}>
      <Icon className={cn('h-3 w-3', isAnimated && 'animate-spin')} />
      {config.label}
    </Badge>
  );
}
