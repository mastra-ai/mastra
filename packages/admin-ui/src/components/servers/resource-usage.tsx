import { Cpu, MemoryStick, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ServerMetrics } from '@/types/api';

interface ResourceUsageProps {
  metrics: ServerMetrics;
  className?: string;
}

export function ResourceUsage({ metrics, className }: ResourceUsageProps) {
  const memoryPercent = (metrics.memoryUsageMb / metrics.memoryLimitMb) * 100;

  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
  };

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4', className)}>
      {/* CPU */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral6 flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            CPU Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.cpuPercent.toFixed(1)}%</div>
          <div className="mt-2 h-2 bg-surface4 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                metrics.cpuPercent < 70 ? 'bg-green-500' : metrics.cpuPercent < 90 ? 'bg-yellow-500' : 'bg-red-500',
              )}
              style={{ width: `${Math.min(metrics.cpuPercent, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Memory */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral6 flex items-center gap-2">
            <MemoryStick className="h-4 w-4" />
            Memory Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics.memoryUsageMb.toFixed(0)}
            <span className="text-sm font-normal text-neutral6"> / {metrics.memoryLimitMb} MB</span>
          </div>
          <div className="mt-2 h-2 bg-surface4 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                memoryPercent < 70 ? 'bg-green-500' : memoryPercent < 90 ? 'bg-yellow-500' : 'bg-red-500',
              )}
              style={{ width: `${Math.min(memoryPercent, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Uptime */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral6 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Uptime
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatUptime(metrics.uptime)}</div>
          <div className="text-sm text-neutral6 mt-1">Running continuously</div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ResourceUsageCompactProps {
  memoryUsageMb?: number | null;
  memoryLimitMb?: number;
  cpuPercent?: number | null;
  className?: string;
}

export function ResourceUsageCompact({
  memoryUsageMb,
  memoryLimitMb = 512,
  cpuPercent,
  className,
}: ResourceUsageCompactProps) {
  const memoryPercent = memoryUsageMb ? (memoryUsageMb / memoryLimitMb) * 100 : 0;

  return (
    <div className={cn('flex items-center gap-4 text-sm', className)}>
      {cpuPercent !== undefined && cpuPercent !== null && (
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-neutral6" />
          <span className={cn(cpuPercent > 80 ? 'text-red-500' : 'text-neutral9')}>{cpuPercent.toFixed(1)}%</span>
        </div>
      )}
      {memoryUsageMb !== undefined && memoryUsageMb !== null && (
        <div className="flex items-center gap-2">
          <MemoryStick className="h-4 w-4 text-neutral6" />
          <span className={cn(memoryPercent > 80 ? 'text-red-500' : 'text-neutral9')}>
            {memoryUsageMb.toFixed(0)} MB
          </span>
        </div>
      )}
    </div>
  );
}
