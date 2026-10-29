import { CalendarIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactElement, Ref } from 'react';
import { CustomRangeEditor } from './custom-range-editor';
import { Button, TriggerChevron } from '@/ds/components/Button/Button';
import type { TextButtonSize } from '@/ds/components/Button/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup/buttons-group';
import { DropdownMenu } from '@/ds/components/DropdownMenu/dropdown-menu';
import { Popover, PopoverTrigger, PopoverContent } from '@/ds/components/Popover/popover';
import { cn } from '@/lib/utils';

export type DateRangePreset = 'all' | 'last-24h' | 'last-3d' | 'last-7d' | 'last-14d' | 'last-30d' | 'custom';

const DATE_PRESETS: { value: DateRangePreset; label: string; ms?: number }[] = [
  { value: 'all', label: 'All' },
  { value: 'last-24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { value: 'last-3d', label: 'Last 3 days', ms: 3 * 24 * 60 * 60 * 1000 },
  { value: 'last-7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: 'last-14d', label: 'Last 14 days', ms: 14 * 24 * 60 * 60 * 1000 },
  { value: 'last-30d', label: 'Last 30 days', ms: 30 * 24 * 60 * 60 * 1000 },
  { value: 'custom', label: 'Custom range...' },
];

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
  /** Size of the trigger Button. Defaults to 'sm', the toolbar rung. */
  size?: TextButtonSize;
  /**
   * The preset a custom range resets to. While a custom range is applied, a × joined to the
   * trigger takes the chevron's place and switches back to it.
   */
  defaultPreset?: DateRangePreset;
  /** The trigger Button. */
  ref?: Ref<HTMLButtonElement>;
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
  size = 'sm',
  defaultPreset,
  ref,
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

  const reset =
    defaultPreset !== undefined && shownPreset === 'custom' ? (
      <Button
        type="button"
        size={`icon-${size}` as const}
        tooltip="Reset time range"
        disabled={disabled}
        onClick={() => applyPreset(defaultPreset)}
      >
        <XIcon />
      </Button>
    ) : undefined;

  const customLabel = `${dateFrom ? dateFrom.toLocaleDateString() : 'Start'} \u2013 ${dateTo ? dateTo.toLocaleDateString() : 'End'}`;
  const trigger = (
    <Button
      ref={ref}
      size={size}
      disabled={disabled}
      icon={<CalendarIcon />}
      iconEnd={reset ? undefined : <TriggerChevron />}
    >
      {shownPreset === 'custom' ? customLabel : datePresetLabel}
    </Button>
  );

  if (shownPreset === 'custom' && !presetMenuOpen) {
    return (
      <JoinReset reset={reset} size={size}>
        <Popover open={customRangeOpen} onOpenChange={setCustomRangeOpen}>
          <PopoverTrigger render={trigger} />
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
      </JoinReset>
    );
  }

  return (
    <JoinReset reset={reset} size={size}>
      <DropdownMenu open={presetMenuOpen} onOpenChange={setPresetMenuOpen}>
        <DropdownMenu.Trigger render={trigger} />
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
    </JoinReset>
  );
}

/** The trigger alone, or joined with the reset × as one pill. */
function JoinReset({ reset, size, children }: { reset?: ReactElement; size: TextButtonSize; children: ReactElement }) {
  if (!reset) return children;
  return (
    <ButtonsGroup size={size}>
      {children}
      {reset}
    </ButtonsGroup>
  );
}
