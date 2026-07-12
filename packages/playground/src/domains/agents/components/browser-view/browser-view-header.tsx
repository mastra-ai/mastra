import { StatusBadge } from '@mastra/playground-ui/components/StatusBadge';
import { cn } from '@mastra/playground-ui/utils/cn';
import { X, ChevronDown, ChevronUp, Minus } from 'lucide-react';
import type { StreamStatus } from '../../hooks/use-browser-stream';

interface BrowserViewHeaderProps {
  url: string | null;
  status: StreamStatus;
  isCollapsed?: boolean;
  className?: string;
  onClose?: () => void;
  onToggleCollapse?: () => void;
  onTuck?: () => void;
}

/**
 * Get StatusBadge configuration based on stream status
 */
function getStatusBadgeConfig(status: StreamStatus): {
  variant: 'success' | 'warning' | 'error' | 'neutral';
  pulse: boolean;
  label: string;
} {
  switch (status) {
    case 'idle':
      return { variant: 'neutral', pulse: false, label: 'Idle' };
    case 'connecting':
      return { variant: 'warning', pulse: true, label: 'Connecting' };
    case 'connected':
      return { variant: 'warning', pulse: true, label: 'Connected' };
    case 'browser_starting':
      return { variant: 'warning', pulse: true, label: 'Starting' };
    case 'streaming':
      return { variant: 'success', pulse: false, label: 'Live' };
    case 'browser_closed':
      return { variant: 'neutral', pulse: false, label: 'Closed' };
    case 'disconnected':
      return { variant: 'error', pulse: true, label: 'Disconnected' };
    case 'error':
      return { variant: 'error', pulse: false, label: 'Error' };
    default:
      return { variant: 'neutral', pulse: false, label: 'Unknown' };
  }
}

/**
 * Browser view header component with URL bar, status indicator, and close button.
 */
export function BrowserViewHeader({
  url,
  status,
  isCollapsed,
  className,
  onClose,
  onToggleCollapse,
  onTuck,
}: BrowserViewHeaderProps) {
  const { variant, pulse, label } = getStatusBadgeConfig(status);

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-border1 bg-surface1 px-3 py-2',
        isCollapsed ? 'rounded-md' : 'rounded-t-md',
        className,
      )}
    >
      {/* URL display */}
      <div className="mr-3 min-w-0 flex-1">
        <span className={cn('block truncate text-sm text-neutral4', !url && 'text-neutral3 italic')}>
          {url || 'No URL'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Status badge */}
        <StatusBadge variant={variant} size="sm" withDot pulse={pulse}>
          {label}
        </StatusBadge>

        {/* Tuck away to pill */}
        {onTuck && (
          <button
            onClick={onTuck}
            className="rounded p-1 text-neutral3 transition-colors hover:bg-surface3 hover:text-neutral6"
            title="Minimize to pill"
          >
            <Minus className="size-4" />
          </button>
        )}

        {/* Collapse/expand toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="rounded p-1 text-neutral3 transition-colors hover:bg-surface3 hover:text-neutral6"
            title={isCollapsed ? 'Expand browser view' : 'Minimize browser view'}
          >
            {isCollapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
        )}

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral3 transition-colors hover:bg-surface3 hover:text-neutral6"
            title="Close browser session"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
