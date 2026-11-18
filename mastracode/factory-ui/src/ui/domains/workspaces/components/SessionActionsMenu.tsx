import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import type { ReactNode, RefObject } from 'react';
import { IconDotGrid1x3Horizontal } from '@mastra/playground-ui/icons/central/IconDotGrid1x3Horizontal';

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
            <IconDotGrid1x3Horizontal />
          </Sidebar.NavAction>
        }
      />
      <DropdownMenu.Content anchor={anchor} align="end">
        {children}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
