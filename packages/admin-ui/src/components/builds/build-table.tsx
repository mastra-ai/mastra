import { Link } from 'react-router';
import { MoreHorizontal, FileText, GitCommit, XCircle, User } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BuildStatusBadge } from './build-status-badge';
import { formatDistanceToNow, format } from 'date-fns';
import { BuildStatus, BuildTrigger, type Build } from '@/types/api';

const triggerConfig: Record<BuildTrigger, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  [BuildTrigger.MANUAL]: { label: 'Manual', variant: 'outline' },
  [BuildTrigger.WEBHOOK]: { label: 'Webhook', variant: 'secondary' },
  [BuildTrigger.SCHEDULE]: { label: 'Scheduled', variant: 'secondary' },
  [BuildTrigger.ROLLBACK]: { label: 'Rollback', variant: 'default' },
};

interface BuildTableProps {
  builds: Build[];
  projectId: string;
  deploymentId: string;
  onCancel?: (buildId: string) => void;
}

export function BuildTable({ builds, projectId, deploymentId, onCancel }: BuildTableProps) {
  const formatDuration = (build: Build) => {
    if (!build.startedAt || !build.completedAt) return '-';
    const start = new Date(build.startedAt).getTime();
    const end = new Date(build.completedAt).getTime();
    const seconds = Math.round((end - start) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Build</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Trigger</TableHead>
          <TableHead>Commit</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {builds.map(build => {
          const triggerInfo = triggerConfig[build.trigger];
          const canCancel =
            build.status === BuildStatus.QUEUED ||
            build.status === BuildStatus.BUILDING ||
            build.status === BuildStatus.DEPLOYING;

          return (
            <TableRow key={build.id}>
              <TableCell>
                <Link
                  to={`/projects/${projectId}/deployments/${deploymentId}/builds/${build.id}`}
                  className="font-mono text-sm hover:text-accent1"
                >
                  #{build.id.slice(0, 8)}
                </Link>
              </TableCell>
              <TableCell>
                <BuildStatusBadge status={build.status} />
              </TableCell>
              <TableCell>
                <Badge variant={triggerInfo.variant}>{triggerInfo.label}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <GitCommit className="h-4 w-4 text-neutral6" />
                  <span className="font-mono text-sm">{build.commitSha.slice(0, 7)}</span>
                </div>
                {build.commitMessage && (
                  <div className="text-sm text-neutral6 truncate max-w-[200px]">{build.commitMessage}</div>
                )}
              </TableCell>
              <TableCell className="text-neutral6">{formatDuration(build)}</TableCell>
              <TableCell className="text-neutral6">
                {formatDistanceToNow(new Date(build.queuedAt), { addSuffix: true })}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/projects/${projectId}/deployments/${deploymentId}/builds/${build.id}`}>
                        <FileText className="mr-2 h-4 w-4" />
                        View Logs
                      </Link>
                    </DropdownMenuItem>
                    {canCancel && onCancel && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-500" onClick={() => onCancel(build.id)}>
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancel Build
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
