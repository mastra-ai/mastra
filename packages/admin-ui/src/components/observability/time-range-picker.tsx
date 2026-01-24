import { useState } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type TimeRange = '15m' | '1h' | '6h' | '24h' | '7d' | '30d' | 'custom';

const presetRanges: { value: TimeRange; label: string }[] = [
  { value: '15m', label: 'Last 15 minutes' },
  { value: '1h', label: 'Last hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

interface TimeRangePickerProps {
  value: TimeRange;
  onChange: (range: TimeRange, startTime?: Date, endTime?: Date) => void;
  className?: string;
}

export function TimeRangePicker({ value, onChange, className }: TimeRangePickerProps) {
  const [open, setOpen] = useState(false);

  const selectedRange = presetRanges.find(r => r.value === value);

  const handleSelect = (range: TimeRange) => {
    onChange(range);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('justify-start text-left font-normal', className)}>
          <Clock className="mr-2 h-4 w-4" />
          {selectedRange?.label ?? 'Select time range'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-1" align="end">
        <div className="space-y-1">
          {presetRanges.map(range => (
            <Button
              key={range.value}
              variant={value === range.value ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => handleSelect(range.value)}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function getTimeRangeParams(range: TimeRange): { startTime: string; endTime: string } {
  const now = new Date();
  let startTime: Date;

  switch (range) {
    case '15m':
      startTime = new Date(now.getTime() - 15 * 60 * 1000);
      break;
    case '1h':
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '6h':
      startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      break;
    case '24h':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  return {
    startTime: startTime.toISOString(),
    endTime: now.toISOString(),
  };
}
