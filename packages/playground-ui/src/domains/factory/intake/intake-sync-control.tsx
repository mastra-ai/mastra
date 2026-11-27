import { useId } from 'react';
import { Switch } from '@/ds/components/Switch';
import { InfoTooltip } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';

export function IntakeSyncControl({
  label = 'Sync issues',
  accessibleLabel,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label?: string;
  accessibleLabel: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Txt as="label" htmlFor={id} variant="caption">
        {label}
      </Txt>
      <InfoTooltip aria-label={`About ${accessibleLabel}`}>{description}</InfoTooltip>
      <Switch
        id={id}
        aria-label={accessibleLabel}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
