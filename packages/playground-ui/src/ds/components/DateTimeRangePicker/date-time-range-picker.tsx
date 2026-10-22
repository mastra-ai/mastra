import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { CustomRangeEditor } from './custom-range-editor';
import { DATE_PRESETS } from './date-range-presets';
import type { DateRangePreset } from './date-range-presets';
import { Button } from '@/ds/components/Button/Button';
import type { ButtonProps } from '@/ds/components/Button/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu/dropdown-menu';
import { Popover, PopoverTrigger, PopoverContent } from '@/ds/components/Popover/popover';
import { cn } from '@/lib/utils';

export type { DateRangePreset } from './date-range-presets';

export interface DateTimeRangePickerProps {
  preset?: DateRangePreset;
  onPresetChange?: (preset: DateRangePreset) => void;
  dateFrom?: Date;
  dateTo?: Date;
  onDateChange?: (value: Date | undefined, type: 'from' | 'to') => void;
  /**
   * Called once with both ends when a custom range is applied. When provided it replaces
   * the two `onDateChange` calls for that step, so consumers can write the range atomically.
   */
  onDateRangeChange?: (from: Date | undefined, to: Date | undefined) => void;
  disabled?: boolean;
  /** Widest custom range that can be applied, in milliseconds. Presets are unaffected. */
  maxRangeMs?: number;
  /** Earliest day a custom range can start on, e.g. the oldest data still kept. Earlier days are disabled. */
  minDate?: Date;
  /** Subset of presets to show. If omitted, all presets are shown. */
  presets?: readonly DateRangePreset[];
  /** Size passed through to the trigger Button. Defaults to 'md'. */
  size?: ButtonProps['size'];
  /**
   * Replace the default Button trigger. Receives the current label (preset name or
   * custom range) and must return an element the menu/popover can attach to.
   */
  renderTrigger?: (props: { label: string; disabled?: boolean }) => ReactElement;
}

export function DateTimeRangePicker({
  preset = 'all',
  onPresetChange,
  dateFrom,
  dateTo,
  onDateChange,
  onDateRangeChange,
  disabled,
  maxRangeMs,
  minDate,
  presets,
  size = 'md',
  renderTrigger,
}: DateTimeRangePickerProps) {
  const visiblePresets = presets ? DATE_PRESETS.filter(p => presets.includes(p.value)) : DATE_PRESETS;
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  // The preset active before "Custom range..." was picked, until a range is applied.
  // "← Presets" restores it instead of jumping to the first preset in the list.
  const [presetBeforeCustom, setPresetBeforeCustom] = useState<DateRangePreset | undefined>();

  // "← Presets" restores the previous preset through the parent, which may apply it a
  // render later (e.g. a router URL update). Show it right away instead of "custom".
  const restoringPreset = presetMenuOpen && preset === 'custom' ? presetBeforeCustom : undefined;
  const shownPreset = restoringPreset ?? preset;
  const datePresetLabel = DATE_PRESETS.find(p => p.value === shownPreset)?.label ?? 'All';

  const applyPreset = (value: DateRangePreset) => {
    onPresetChange?.(value);
    const entry = DATE_PRESETS.find(p => p.value === value);
    if (entry?.ms) {
      onDateChange?.(new Date(Date.now() - entry.ms), 'from');
      onDateChange?.(undefined, 'to');
    } else {
      onDateChange?.(undefined, 'from');
      onDateChange?.(undefined, 'to');
    }
  };

  const handlePresetSelect = (value: DateRangePreset) => {
    setPresetMenuOpen(false);
    if (value === 'custom') {
      if (preset !== 'custom') setPresetBeforeCustom(preset);
      onPresetChange?.(value);
      setCustomRangeOpen(true);
      return;
    }
    setPresetBeforeCustom(undefined);
    applyPreset(value);
  };

  const applyCustomRange = (fromDate: Date | undefined, toDate: Date | undefined) => {
    if (onDateRangeChange) {
      onDateRangeChange(fromDate, toDate);
    } else {
      onDateChange?.(fromDate, 'from');
      onDateChange?.(toDate, 'to');
    }
    setPresetBeforeCustom(undefined);
    setCustomRangeOpen(false);
  };

  // Back to the preset list. Restores the preset the user came from; an applied custom
  // range matches no preset, so it stays and the list shows "Custom range..." as current.
  const showPresets = () => {
    setCustomRangeOpen(false);
    if (presetBeforeCustom) applyPreset(presetBeforeCustom);
    setPresetMenuOpen(true);
  };

  const customLabel = `${dateFrom ? dateFrom.toLocaleDateString() : 'Start'} \u2013 ${dateTo ? dateTo.toLocaleDateString() : 'End'}`;

  if (shownPreset === 'custom' && !presetMenuOpen) {
    return (
      <Popover open={customRangeOpen} onOpenChange={setCustomRangeOpen}>
        {renderTrigger ? (
          <PopoverTrigger render={renderTrigger({ label: customLabel, disabled })} />
        ) : (
          <PopoverTrigger asChild>
            <Button size={size} disabled={disabled} icon={<CalendarIcon />}>
              {customLabel}
            </Button>
          </PopoverTrigger>
        )}
        <PopoverContent align="start" className={cn('w-auto p-0')}>
          <CustomRangeEditor
            dateFrom={dateFrom}
            dateTo={dateTo}
            disabled={disabled}
            maxRangeMs={maxRangeMs}
            minDate={minDate}
            onApply={applyCustomRange}
            onShowPresets={showPresets}
          />
        </PopoverContent>
      </Popover>
    );
  }

  const triggerLabel = shownPreset === 'custom' ? customLabel : datePresetLabel;

  return (
    <DropdownMenu open={presetMenuOpen} onOpenChange={setPresetMenuOpen}>
      {renderTrigger ? (
        <DropdownMenu.Trigger render={renderTrigger({ label: triggerLabel, disabled })} />
      ) : (
        <DropdownMenu.Trigger asChild>
          <Button size={size} disabled={disabled} icon={<CalendarIcon />}>
            {triggerLabel}
          </Button>
        </DropdownMenu.Trigger>
      )}
      <DropdownMenu.Content align="start">
        {/* Items select on click (not onValueChange) so re-picking the checked
            "Custom range..." still reopens the range editor. */}
        <DropdownMenu.RadioGroup value={shownPreset}>
          {visiblePresets.map(p => (
            <DropdownMenu.RadioItem
              key={p.value}
              value={p.value}
              closeOnClick
              onClick={() => handlePresetSelect(p.value)}
            >
              {p.label}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
