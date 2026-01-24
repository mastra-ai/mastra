import { ExternalLink, Activity, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ServerHealthBadge } from './server-health-badge';
import { ResourceUsageCompact } from './resource-usage';
import type { RunningServer } from '@/types/api';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface ServerStatusCardProps {
  server: RunningServer;
  className?: string;
}

export function ServerStatusCard({ server, className }: ServerStatusCardProps) {
  const serverUrl = `http://${server.host}:${server.port}`;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Server Status
          </CardTitle>
          <ServerHealthBadge status={server.healthStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Server URL */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-neutral6">
            <Globe className="h-4 w-4" />
            <span className="font-mono">{serverUrl}</span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <a href={serverUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>

        {/* Resource usage */}
        <ResourceUsageCompact memoryUsageMb={server.memoryUsageMb} cpuPercent={server.cpuPercent} />

        {/* Last health check */}
        {server.lastHealthCheck && (
          <div className="text-xs text-neutral6">
            Last checked {formatDistanceToNow(new Date(server.lastHealthCheck), { addSuffix: true })}
          </div>
        )}

        {/* Started time */}
        <div className="text-xs text-neutral6">
          Started {formatDistanceToNow(new Date(server.startedAt), { addSuffix: true })}
        </div>
      </CardContent>
    </Card>
  );
}
