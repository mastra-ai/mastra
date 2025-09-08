import { Badge } from '@/ds/components/Badge';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';
import { ChevronUpIcon } from 'lucide-react';
import { useState } from 'react';

export interface BadgeWrapperProps {
  children?: React.ReactNode;
  title?: React.ReactNode;
  initialCollapsed?: boolean;
  icon?: React.ReactNode;
  collapsible?: boolean;
}

export const BadgeWrapper = ({
  children,
  initialCollapsed = true,
  icon,
  title,
  collapsible = true,
}: BadgeWrapperProps) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  return (
    <div className="mb-2">
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

      {!isCollapsed && (
        <div className="pt-2">
          <div className="border-sm border-border1 rounded-lg bg-surface4">
            <div className="p-4 border-b-sm border-border1">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
};
