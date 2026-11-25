import type { ReactNode } from 'react';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import type { DropdownMenuTriggerProps } from '@/ds/components/DropdownMenu';
import { IconArrowRotateCounterClockwise } from '@/ds/icons/central/IconArrowRotateCounterClockwise';
import { IconSettingsSliderHor } from '@/ds/icons/central/IconSettingsSliderHor';

export function PropertiesMenu({
  label,
  changedCount,
  changes = [],
  onReset,
  align = 'start',
  variant = 'ghost',
  icon = <IconSettingsSliderHor aria-hidden />,
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
          <IconArrowRotateCounterClockwise aria-hidden />
          <span>Reset to default</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
