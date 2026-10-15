import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { RotateCcw, Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';

const MENU_LABEL = 'Sessions properties';

export function SessionListProperties({
  changedCount,
  onReset,
  children,
}: {
  changedCount: number;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        variant="ghost"
        size="icon-sm"
        aria-label={changedCount === 0 ? MENU_LABEL : `${MENU_LABEL}, ${changedCount} changed`}
        tooltip={MENU_LABEL}
      >
        <Settings2 size={15} aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        {children}
        <DropdownMenu.Separator />
        <DropdownMenu.Item disabled={changedCount === 0} onClick={onReset}>
          <RotateCcw aria-hidden />
          <span>Reset to default</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
