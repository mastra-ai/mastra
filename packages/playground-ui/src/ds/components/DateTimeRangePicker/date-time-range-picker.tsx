import { startOfDay } from 'date-fns';
import { useState } from 'react';
import type { ReactNode, Ref } from 'react';
import { CustomRangeEditor } from './custom-range-editor';
import { Button, TriggerChevron } from '@/ds/components/Button/Button';
import type { TextButtonSize } from '@/ds/components/Button/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup/buttons-group';
import { DropdownMenu } from '@/ds/components/DropdownMenu/dropdown-menu';
import { Popover, PopoverTrigger, PopoverContent } from '@/ds/components/Popover/popover';
import { IconCalendar1 } from '@/ds/icons/central/IconCalendar1';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';
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

const sameTime = (a: Date | undefined, b: Date | undefined) => a?.getTime() === b?.getTime();

/**
 * Whether a named range breaks the limits the custom editor enforces: it starts before
 * `minDate`'s day, or spans more than `maxRangeMs` (an open end counts up to now).
 */
function outsideLimits(range: DateTimeRangePickerNamedRange, minDate?: Date, maxRangeMs?: number) {
  const tooEarly = minDate !== undefined && range.from < startOfDay(minDate);
  const span = (range.to ?? new Date()).getTime() - range.from.getTime();
  const tooWide = maxRangeMs !== undefined && span > maxRangeMs;
  return tooEarly || tooWide;
}

const fmtClock = (d: Date) =>
  d.toLocaleTimeString('en-US', d.getMinutes() === 0 ? { hour: 'numeric' } : { hour: 'numeric', minute: '2-digit' });

/**
 * A custom range as day and time, kept short: `Oct 21, 2:05 PM – 4 PM` within one day,
 * `Oct 20, 12 AM – Oct 27, 9:30 AM` across days, with years only outside the current one.
 */
function customRangeLabel(dateFrom: Date | undefined, dateTo: Date | undefined) {
  const thisYear = new Date().getFullYear();
  const withYear = [dateFrom, dateTo].some(d => d && d.getFullYear() !== thisYear);
  const fmtDay = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear && { year: 'numeric' }) });
  const fmtMoment = (d: Date) => `${fmtDay(d)}, ${fmtClock(d)}`;

  const start = dateFrom ? fmtMoment(dateFrom) : 'Start';
  if (!dateTo) return `${start} \u2013 End`;
  const sameDay = dateFrom !== undefined && fmtDay(dateFrom) === fmtDay(dateTo);
  return `${start} \u2013 ${sameDay ? fmtClock(dateTo) : fmtMoment(dateTo)}`;
}

/** A fixed range offered beside the presets, e.g. the current billing period. */
export type DateTimeRangePickerNamedRange = { label: string; from: Date; to?: Date };

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
  /**
   * Fixed ranges listed above the presets, e.g. `{ label: 'This period', from: periodStart }`.
   * Picking one applies it as a custom range; while it's applied the trigger shows its label.
   */
  namedRanges?: readonly DateTimeRangePickerNamedRange[];
  /** Size of the trigger Button. Defaults to 'sm', the toolbar rung. */
  size?: TextButtonSize;
  /**
   * The preset a custom range resets to. While a custom range is applied, a × joined to the
   * trigger takes the chevron's place and switches back to it.
   */
  defaultPreset?: DateRangePreset;
  /** Replaces what the reset × does, e.g. to undo a histogram zoom before falling back to `defaultPreset`. */
  onReset?: () => void;
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
  namedRanges = [],
  size = 'sm',
  defaultPreset,
  onReset,
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

  // The applied custom range, when it is one of the named ranges.
  const namedIndex =
    shownPreset === 'custom' ? namedRanges.findIndex(r => sameTime(r.from, dateFrom) && sameTime(r.to, dateTo)) : -1;
  const named = namedRanges[namedIndex];
  const canReset = defaultPreset !== undefined && shownPreset === 'custom' && !named;
  // A named range shows the preset list, unless "Custom range..." was picked to edit it.
  const editingCustomRange = shownPreset === 'custom' && !presetMenuOpen && (!named || customRangeOpen);
  const label = named ? named.label : shownPreset === 'custom' ? customRangeLabel(dateFrom, dateTo) : datePresetLabel;

  const applyNamedRange = (range: DateTimeRangePickerNamedRange) => {
    setPresetMenuOpen(false);
    onPresetChange?.('custom');
    applyCustomRange(range.from, range.to);
  };
  const trigger = (
    <Button
      ref={ref}
      size={size}
      disabled={disabled}
      icon={<IconCalendar1 />}
      iconEnd={canReset ? undefined : <TriggerChevron />}
    >
      {label}
    </Button>
  );

  return (
    <JoinReset
      size={size}
      reset={
        canReset && (
          <ResetRangeButton size={size} disabled={disabled} onReset={onReset ?? (() => applyPreset(defaultPreset))} />
        )
      }
    >
      {editingCustomRange && (
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
      )}
      {!editingCustomRange && (
        <DropdownMenu open={presetMenuOpen} onOpenChange={setPresetMenuOpen}>
          <DropdownMenu.Trigger render={trigger} />
          <DropdownMenu.Content align="start">
            {/* Items select on click (not onValueChange) so re-picking the checked
              "Custom range..." still reopens the range editor. */}
            <DropdownMenu.RadioGroup value={named ? `named-${namedIndex}` : shownPreset}>
              {namedRanges.map((r, i) => (
                <DropdownMenu.RadioItem
                  key={`named-${i}`}
                  value={`named-${i}`}
                  disabled={outsideLimits(r, minDate, maxRangeMs)}
                  closeOnClick
                  onClick={() => applyNamedRange(r)}
                >
                  {r.label}
                </DropdownMenu.RadioItem>
              ))}
              {namedRanges.length > 0 && <DropdownMenu.Separator />}
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
      )}
    </JoinReset>
  );
}

/** Switches a custom range back to the picker's default preset. */
function ResetRangeButton({
  size,
  disabled,
  onReset,
}: {
  size: TextButtonSize;
  disabled?: boolean;
  onReset: () => void;
}) {
  return (
    <Button
      type="button"
      size={`icon-${size}` as const}
      tooltip="Reset time range"
      disabled={disabled}
      onClick={onReset}
    >
      <IconCrossMedium />
    </Button>
  );
}

/** The trigger alone, or joined with the reset × as one pill. */
function JoinReset({ reset, size, children }: { reset: ReactNode; size: TextButtonSize; children: ReactNode }) {
  if (!reset) return children;
  return (
    <ButtonsGroup size={size}>
      {children}
      {reset}
    </ButtonsGroup>
  );
}
