import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import type { DropdownMenuTriggerProps } from '@mastra/playground-ui/components/DropdownMenu';
import { RotateCcw, Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';

export function PropertiesMenu({
  label,
  changedCount,
  changes = [],
  onReset,
  align = 'start',
  variant = 'ghost',
  icon = <Settings2 size={15} aria-hidden />,
  children,
}: {
  label: string;
  changedCount: number;
  changes?: readonly string[];
  onReset: () => void;
  align?: 'start' | 'end';
  variant?: DropdownMenuTriggerProps['variant'];
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        variant={variant}
        size={changedCount === 0 ? 'icon-sm' : 'sm'}
        aria-label={changedCount === 0 ? label : `${label}, ${changedCount} changed`}
        tooltip={
          changes.length === 0 ? (
            label
          ) : (
            <span className="flex flex-col">
              <span>{label}</span>
              {changes.map(change => (
                <span key={change} className="text-muted-foreground">
                  {change}
                </span>
              ))}
            </span>
          )
        }
      >
        {icon}
        {changedCount > 0 && <span className="tabular-nums">{changedCount}</span>}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align={align}>
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
