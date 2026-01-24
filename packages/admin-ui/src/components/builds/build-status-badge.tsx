import { Badge } from '@/components/ui/badge';
import { Clock, Loader2, CheckCircle2, XCircle, Ban, Rocket } from 'lucide-react';
import { BuildStatus } from '@/types/api';
import { cn } from '@/lib/utils';

const statusConfig: Record<
  BuildStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  [BuildStatus.QUEUED]: { label: 'Queued', variant: 'secondary', icon: Clock },
  [BuildStatus.BUILDING]: { label: 'Building', variant: 'warning', icon: Loader2 },
  [BuildStatus.DEPLOYING]: { label: 'Deploying', variant: 'default', icon: Rocket },
  [BuildStatus.SUCCEEDED]: { label: 'Succeeded', variant: 'success', icon: CheckCircle2 },
  [BuildStatus.FAILED]: { label: 'Failed', variant: 'destructive', icon: XCircle },
  [BuildStatus.CANCELLED]: { label: 'Cancelled', variant: 'outline', icon: Ban },
};

interface BuildStatusBadgeProps {
  status: BuildStatus;
  className?: string;
}

export function BuildStatusBadge({ status, className }: BuildStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isAnimated = status === BuildStatus.BUILDING || status === BuildStatus.DEPLOYING;

  return (
    <Badge variant={config.variant} className={cn('flex items-center gap-1.5', className)}>
      <Icon className={cn('h-3 w-3', isAnimated && 'animate-spin')} />
      {config.label}
    </Badge>
  );
}
