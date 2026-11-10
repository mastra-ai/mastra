import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
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
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Session actions for ${name}`}
            disabled={disabled}
            className="group-focus-within/session:flex group-hover/session:flex data-[popup-open]:flex pointer-fine:hidden"
          >
            <IconDotGrid1x3Horizontal />
          </Button>
        }
      />
      <DropdownMenu.Content anchor={anchor} align="end">
        {children}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
