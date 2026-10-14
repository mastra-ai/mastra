import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { RotateCcw, Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';

export function SessionListProperties({
  label,
  changedCount,
  onReset,
  children,
}: {
  label: 'Work sessions' | 'Review sessions' | 'User sessions';
  changedCount: number;
  onReset: () => void;
  children: ReactNode;
}) {
  const menuLabel = `${label} properties`;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        variant={changedCount > 0 ? 'default' : 'ghost'}
        size="icon-sm"
        aria-label={changedCount === 0 ? menuLabel : `${menuLabel}, ${changedCount} changed`}
        tooltip={menuLabel}
      >
        <Settings2 size={15} aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
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
