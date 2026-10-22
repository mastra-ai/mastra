import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
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
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Session actions for ${name}`}
            disabled={disabled}
            className="hidden group-focus-within/session:flex group-hover/session:flex data-[popup-open]:flex"
          >
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenu.Content anchor={anchor} align="end">
        {children}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
