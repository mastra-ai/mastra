import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/ds/components/StatusBadge';
import type { StreamStatus } from '../../hooks/use-browser-stream';

interface BrowserViewHeaderProps {
  url: string | null;
  status: StreamStatus;
  isCollapsed?: boolean;
  className?: string;
  onClose?: () => void;
  onToggleCollapse?: () => void;
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
}: BrowserViewHeaderProps) {
  const { variant, pulse, label } = getStatusBadgeConfig(status);

  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-2 border-b border-border1 bg-surface1',
        isCollapsed ? 'rounded-md' : 'rounded-t-md',
        className,
      )}
    >
      {/* URL display */}
      <div className="flex-1 min-w-0 mr-3">
        <span className={cn('text-sm text-neutral4 truncate block', !url && 'text-neutral3 italic')}>
          {url || 'No URL'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Status badge */}
        <StatusBadge variant={variant} size="sm" withDot pulse={pulse}>
          {label}
        </StatusBadge>

        {/* Collapse/expand toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-surface3 text-neutral3 hover:text-neutral6 transition-colors"
            title={isCollapsed ? 'Expand browser view' : 'Collapse browser view'}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        )}

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface3 text-neutral3 hover:text-neutral6 transition-colors"
            title="Close browser session"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
