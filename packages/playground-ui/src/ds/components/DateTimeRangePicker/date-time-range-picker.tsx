import { isValid, parse } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/ds/components/Button/Button';
import type { ButtonProps } from '@/ds/components/Button/Button';
import { DatePicker, TimePicker } from '@/ds/components/DateTimePicker';
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

function buildDateWithTime(date: Date, timeStr: string): Date | null {
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const combined = parse(timeStr, 'h:mm a', dateOnly);
  return isValid(combined) ? combined : null;
}

export interface DateTimeRangePickerProps {
  preset?: DateRangePreset;
  onPresetChange?: (preset: DateRangePreset) => void;
  dateFrom?: Date;
  dateTo?: Date;
  onDateChange?: (value: Date | undefined, type: 'from' | 'to') => void;
  disabled?: boolean;
  /** Subset of presets to show. If omitted, all presets are shown. */
  presets?: readonly DateRangePreset[];
  /** Size passed through to the trigger Button. Defaults to 'default'. */
  size?: ButtonProps['size'];
}

export function DateTimeRangePicker({
  preset = 'all',
  onPresetChange,
  dateFrom,
  dateTo,
  onDateChange,
  disabled,
  presets,
  size = 'default',
}: DateTimeRangePickerProps) {
  const visiblePresets = presets ? DATE_PRESETS.filter(p => presets.includes(p.value)) : DATE_PRESETS;
  const fallbackPreset: DateRangePreset = visiblePresets.find(p => p.value !== 'custom')?.value ?? 'all';
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [draftDateFrom, setDraftDateFrom] = useState<Date | undefined>(dateFrom);
  const [draftDateTo, setDraftDateTo] = useState<Date | undefined>(dateTo);
  const [draftTimeFrom, setDraftTimeFrom] = useState('12:00 AM');
  const [draftTimeTo, setDraftTimeTo] = useState('11:59 PM');
  const [customRangeError, setCustomRangeError] = useState<string | undefined>();

  const datePresetLabel = DATE_PRESETS.find(p => p.value === preset)?.label ?? 'All';

  const handlePresetSelect = (value: DateRangePreset) => {
    onPresetChange?.(value);
    if (value === 'custom') {
      setDraftDateFrom(dateFrom);
      setDraftDateTo(dateTo);
      setDraftTimeFrom('12:00 AM');
      setDraftTimeTo('11:59 PM');
      setCustomRangeOpen(true);
      return;
    }
    const entry = DATE_PRESETS.find(p => p.value === value);
    if (entry?.ms) {
      onDateChange?.(new Date(Date.now() - entry.ms), 'from');
      onDateChange?.(undefined, 'to');
    } else {
      onDateChange?.(undefined, 'from');
      onDateChange?.(undefined, 'to');
    }
  };

  const applyCustomRange = () => {
    const fromDate = draftDateFrom ? (buildDateWithTime(draftDateFrom, draftTimeFrom) ?? draftDateFrom) : undefined;
    const toDate = draftDateTo ? (buildDateWithTime(draftDateTo, draftTimeTo) ?? draftDateTo) : undefined;
    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      setCustomRangeError('Start date/time must be before end date/time');
      return;
    }
    setCustomRangeError(undefined);
    onDateChange?.(fromDate, 'from');
    onDateChange?.(toDate, 'to');
    setCustomRangeOpen(false);
  };

  if (preset === 'custom') {
    return (
      <Popover open={customRangeOpen} onOpenChange={setCustomRangeOpen}>
        <PopoverTrigger asChild>
          <Button size={size} disabled={disabled}>
            <CalendarIcon />
            {dateFrom ? dateFrom.toLocaleDateString() : 'Start'} {' \u2013 '}
            {dateTo ? dateTo.toLocaleDateString() : 'End'}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className={cn('w-auto p-0')}>
          <div className={cn('flex')}>
            <div className={cn('border-r border-border1')}>
              <span className={cn('text-ui-sm text-neutral3 font-medium px-4 pt-3 block')}>Start</span>
              <DatePicker
                mode="single"
                selected={draftDateFrom}
                month={draftDateFrom}
                onSelect={setDraftDateFrom}
                disabled={disabled}
                toDate={draftDateTo}
              />
              <TimePicker
                className="mx-4 mb-3 w-auto"
                defaultValue={draftTimeFrom}
                onValueChange={v => {
                  if (!disabled) setDraftTimeFrom(v);
                }}
              />
            </div>
            <div>
              <span className={cn('text-ui-sm text-neutral3 font-medium px-4 pt-3 block')}>End</span>
              <DatePicker
                mode="single"
                selected={draftDateTo}
                month={draftDateTo}
                onSelect={setDraftDateTo}
                disabled={disabled}
                fromDate={draftDateFrom}
              />
              <TimePicker
                className="mx-4 mb-3 w-auto"
                defaultValue={draftTimeTo}
                onValueChange={v => {
                  if (!disabled) setDraftTimeTo(v);
                }}
              />
            </div>
          </div>
          {customRangeError && <p className={cn('text-ui-sm text-red-500 px-4 pb-1')}>{customRangeError}</p>}
          <div className={cn('flex justify-between items-center px-4 pb-3')}>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                'text-ui-sm text-neutral3 hover:text-neutral4',
                disabled && 'opacity-50 pointer-events-none',
              )}
              onClick={() => {
                setCustomRangeError(undefined);
                handlePresetSelect(fallbackPreset);
              }}
            >
              &larr; Presets
            </button>
            <Button variant="primary" size="sm" onClick={applyCustomRange} disabled={disabled}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button size={size} disabled={disabled}>
          <CalendarIcon />
          {datePresetLabel}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        {visiblePresets.map(p => (
          <DropdownMenu.Item key={p.value} onSelect={() => handlePresetSelect(p.value)}>
            {p.label}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
