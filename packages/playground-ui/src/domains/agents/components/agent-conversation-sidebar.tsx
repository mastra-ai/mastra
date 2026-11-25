import type { ReactNode } from 'react';
import { Kbd } from '@/ds/components/Kbd';
import { ThreadList, ThreadListSeparator } from '@/ds/components/ThreadList';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { PanelEdgeIcon } from '@/lib/resize/panel-edge-icon';
import { panelIconButtonClass } from '@/lib/resize/panel-icon-button';
import { cn } from '@/lib/utils';

export interface AgentConversationSidebarProps {
  newThreadSlot: ReactNode;
  children?: ReactNode;
  embedded?: boolean;
  isLoading?: boolean;
  onCollapse?: () => void;
}

/** Thread-list chrome shared by Studio and hosted agent pages; the host supplies navigation and actions. */
export const AgentConversationSidebar = ({
  newThreadSlot,
  children,
  embedded = false,
  isLoading = false,
  onCollapse,
}: AgentConversationSidebarProps) => {
  const isMobile = useIsMobile();

  return (
    <ThreadList embedded={embedded}>
      <div className="flex items-center gap-1 pt-[3px]">
        {newThreadSlot}
        {onCollapse && !isMobile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Hide threads panel"
                className={cn(panelIconButtonClass, 'shrink-0')}
                onClick={onCollapse}
              >
                <Icon>
                  <PanelEdgeIcon side="left" />
                </Icon>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <span className="inline-flex items-center gap-1.5">
                Hide threads panel <Kbd size="xs">{'{'}</Kbd>
              </span>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <ThreadListSeparator />
      {!isLoading && <div className="pt-1">{children}</div>}
    </ThreadList>
  );
};
