import { Play, Square, RotateCcw, History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeploymentStatus } from '@/types/api';

interface DeploymentActionsProps {
  status: DeploymentStatus;
  onDeploy?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  onRollback?: () => void;
  loading?: boolean;
  canRollback?: boolean;
}

export function DeploymentActions({
  status,
  onDeploy,
  onStop,
  onRestart,
  onRollback,
  loading = false,
  canRollback = false,
}: DeploymentActionsProps) {
  const isRunning = status === DeploymentStatus.RUNNING;
  const isBuilding = status === DeploymentStatus.BUILDING;
  const isStopped = status === DeploymentStatus.STOPPED;
  const isFailed = status === DeploymentStatus.FAILED;
  const isPending = status === DeploymentStatus.PENDING;

  // Primary action based on status
  const primaryAction = () => {
    if (isRunning) {
      return {
        label: 'Restart',
        icon: RotateCcw,
        onClick: onRestart,
        disabled: !onRestart,
      };
    }
    if (isStopped || isFailed || isPending) {
      return {
        label: 'Deploy',
        icon: Play,
        onClick: onDeploy,
        disabled: !onDeploy,
      };
    }
    return null;
  };

  const primary = primaryAction();

  if (loading) {
    return (
      <Button disabled size="sm">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (isBuilding) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Building...
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {primary && (
        <Button size="sm" onClick={primary.onClick} disabled={primary.disabled || loading}>
          <primary.icon className="mr-2 h-4 w-4" />
          {primary.label}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            More
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isRunning && onDeploy && (
            <DropdownMenuItem onClick={onDeploy}>
              <Play className="mr-2 h-4 w-4" />
              Deploy
            </DropdownMenuItem>
          )}
          {isRunning && onStop && (
            <DropdownMenuItem onClick={onStop}>
              <Square className="mr-2 h-4 w-4" />
              Stop
            </DropdownMenuItem>
          )}
          {isRunning && onRestart && (
            <DropdownMenuItem onClick={onRestart}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restart
            </DropdownMenuItem>
          )}
          {canRollback && onRollback && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onRollback}>
                <History className="mr-2 h-4 w-4" />
                Rollback to Previous
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
