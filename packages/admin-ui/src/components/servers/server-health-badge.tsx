import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, StopCircle } from 'lucide-react';
import { HealthStatus } from '@/types/api';
import { cn } from '@/lib/utils';

const statusConfig: Record<
  HealthStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  [HealthStatus.STARTING]: { label: 'Starting', variant: 'warning', icon: Loader2 },
  [HealthStatus.HEALTHY]: { label: 'Healthy', variant: 'success', icon: CheckCircle2 },
  [HealthStatus.UNHEALTHY]: { label: 'Unhealthy', variant: 'destructive', icon: XCircle },
  [HealthStatus.STOPPING]: { label: 'Stopping', variant: 'secondary', icon: StopCircle },
};

interface ServerHealthBadgeProps {
  status: HealthStatus;
  className?: string;
}

export function ServerHealthBadge({ status, className }: ServerHealthBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isAnimated = status === HealthStatus.STARTING || status === HealthStatus.STOPPING;

  return (
    <Badge variant={config.variant} className={cn('flex items-center gap-1.5', className)}>
      <Icon className={cn('h-3 w-3', isAnimated && 'animate-spin')} />
      {config.label}
    </Badge>
  );
}
