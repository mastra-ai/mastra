import { Badge } from '@/ds/components/Badge';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';
import { ChevronUpIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useState } from 'react';

export interface BadgeWrapperProps {
  children?: React.ReactNode;
  title?: React.ReactNode;
  initialCollapsed?: boolean;
  icon?: React.ReactNode;
  collapsible?: boolean;
  extraInfo?: React.ReactNode;
  'data-testid'?: string;
}

export const BadgeWrapper = ({
  children,
  initialCollapsed = true,
  icon,
  title,
  collapsible = true,
  extraInfo,
  'data-testid': dataTestId,
}: BadgeWrapperProps) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  useEffect(() => {
    setIsCollapsed(initialCollapsed);
  }, [initialCollapsed]);

  return (
    <div className="mb-4" data-testid={dataTestId}>
      <div className="flex flex-row gap-2 items-center justify-between">
        <button
          onClick={collapsible ? () => setIsCollapsed(s => !s) : undefined}
          className="flex items-center gap-2 disabled:cursor-not-allowed"
          disabled={!collapsible}
          type="button"
        >
          <Icon>
            <ChevronUpIcon className={cn('transition-all', isCollapsed ? 'rotate-90' : 'rotate-180')} />
          </Icon>
          <Badge icon={icon}>{title}</Badge>
        </button>
        {extraInfo}
      </div>

      {!isCollapsed && (
        <div className="pt-2">
          <div className="p-4 rounded-lg bg-surface2 flex flex-col gap-4">{children}</div>
        </div>
      )}
    </div>
  );
};
