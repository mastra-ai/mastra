import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { MoreHorizontal } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';

export function SessionActionsMenu({
  name,
  anchor,
  disabled,
  children,
}: {
  name: string;
  anchor: RefObject<HTMLElement | null>;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Sidebar.NavAction
            aria-label={`Session actions for ${name}`}
            disabled={disabled}
            className="group-focus-within/nav-row:flex group-hover/nav-row:flex data-[popup-open]:flex pointer-fine:hidden"
          >
            <MoreHorizontal />
          </Sidebar.NavAction>
        }
      />
      <DropdownMenu.Content anchor={anchor} align="end">
        {children}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
