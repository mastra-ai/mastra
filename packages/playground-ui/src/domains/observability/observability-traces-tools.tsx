import { SelectField, DateTimePicker } from '@/components/ui/elements';
import { Button } from '@/components/ui/elements/buttons';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';

type ObservabilityTracesToolsProps = {
  onEntityChange: (val: string) => void;
  selectedEntity?: string;
  entityOptions?: { value: string; label: string }[];
  onReset?: () => void;
  onDateChange?: (value: Date | null | undefined, type: 'from' | 'to') => void;
  selectedDateFrom?: Date | null | undefined;
  selectedDateTo?: Date | null | undefined;
};

export function ObservabilityTracesTools({
  onEntityChange,
  onReset,
  selectedEntity,
  entityOptions,
  onDateChange,
  selectedDateFrom,
  selectedDateTo,
}: ObservabilityTracesToolsProps) {
  return (
    <div className={cn('flex flex-wrap gap-x-[2rem] gap-y-[1rem]')}>
      <SelectField
        label="Filter by Entity"
        name={'select-entity'}
        placeholder="Select..."
        options={entityOptions || []}
        onValueChange={onEntityChange}
        value={selectedEntity}
        className="min-w-[20rem]"
      />

      <div className={cn('flex gap-[1rem] items-center flex-wrap')}>
        <span className={cn('shrink-0 text-[0.875rem] text-icon3')}>Filter by Date & time range</span>
        <DateTimePicker
          placeholder="From"
          value={selectedDateFrom}
          maxValue={selectedDateTo}
          onValueChange={date => onDateChange?.(date, 'from')}
          className="min-w-[15rem]"
          defaultTimeStrValue="12:00 AM"
        />
        <DateTimePicker
          placeholder="To"
          value={selectedDateTo}
          minValue={selectedDateFrom}
          onValueChange={date => onDateChange?.(date, 'to')}
          className="min-w-[15rem]"
          defaultTimeStrValue="11:59 PM"
        />
      </div>
      <Button variant="primary" onClick={onReset} className="ml-auto">
        Reset <XIcon />
      </Button>
    </div>
  );
}
