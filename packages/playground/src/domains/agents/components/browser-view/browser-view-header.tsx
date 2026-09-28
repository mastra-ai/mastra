import { Badge } from '@mastra/playground-ui/components/Badge';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { X, ChevronDown, ChevronUp, Minus } from 'lucide-react';
import type { StreamStatus } from '../../hooks/use-browser-stream';
import { streamStatusBadges } from './stream-status-badges';

interface BrowserViewHeaderProps {
  url: string | null;
  status: StreamStatus;
  isCollapsed?: boolean;
  className?: string;
  onClose?: () => void;
  onToggleCollapse?: () => void;
  onTuck?: () => void;
}

export function BrowserViewHeader({
  url,
  status,
  isCollapsed,
  className,
  onClose,
  onToggleCollapse,
  onTuck,
}: BrowserViewHeaderProps) {
  const { variant, indicator, label } = streamStatusBadges[status];

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-border bg-sidebar px-3 py-2',
        isCollapsed ? 'rounded-md' : 'rounded-t-md',
        className,
      )}
    >
      <div className="mr-3 min-w-0 flex-1">
        <span className={cn('block truncate text-body text-muted-foreground', !url && 'text-muted-foreground italic')}>
          {url || 'No URL'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={variant} size="sm" indicator={indicator}>
          {label}
        </Badge>

        {onTuck && (
          <button
            type="button"
            onClick={onTuck}
            className={cn('rounded p-1 hover:bg-fill-subtle', quietTextHover, controlStateColorTransition)}
            title="Minimize to pill"
          >
            <Minus className="h-4 w-4" />
          </button>
        )}

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn('rounded p-1 hover:bg-fill-subtle', quietTextHover, controlStateColorTransition)}
            title={isCollapsed ? 'Expand browser view' : 'Minimize browser view'}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={cn('rounded p-1 hover:bg-fill-subtle', quietTextHover, controlStateColorTransition)}
            title="Close browser session"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
