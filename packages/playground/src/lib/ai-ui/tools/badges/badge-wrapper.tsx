import { Badge } from '@mastra/playground-ui/components/Badge';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronUpIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useChatRunning } from '@/lib/ai-ui/chat/chat-context';

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
  const { isRunning } = useChatRunning();
  // A badge already on screen when the thread loaded was not just called.
  const [arrivedLive] = useState(() => isRunning);

  useEffect(() => {
    setIsCollapsed(initialCollapsed);
  }, [initialCollapsed]);

  return (
    <div
      className={cn('mb-4', arrivedLive && 'motion-safe:animate-in fade-in-0 slide-in-from-bottom-1')}
      data-testid={dataTestId}
    >
      <div className="flex flex-row items-center justify-between gap-2">
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
          <div className="bg-surface2 flex flex-col gap-4 rounded-lg p-4">{children}</div>
        </div>
      )}
    </div>
  );
};
