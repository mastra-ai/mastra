import { DatePicker } from '@/components/ui/date-picker';
import { SelectField } from '@/components/ui/elements';
import { Button } from '@/components/ui/elements/buttons';
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
  console.log({ selectedEntity });

  return (
    <div className="flex gap-[1rem] items-center">
      <SelectField
        label="Filter by Entity"
        name={'select-entity'}
        placeholder="Select..."
        options={entityOptions || []}
        onValueChange={onEntityChange}
        value={selectedEntity}
      />

      <div className="flex gap-[.5rem] items-center">
        <label className="shrink-0 text-[0.875rem] text-icon3">Filter by Date range</label>
        <div className="flex gap-[1rem]">
          <DatePicker
            placeholder="From"
            value={selectedDateFrom}
            setValue={date => onDateChange?.(date, 'from')}
            clearable={true}
            className="min-w-[10rem]"
          />
          <DatePicker
            placeholder="To"
            value={selectedDateTo}
            setValue={date => onDateChange?.(date, 'to')}
            clearable={true}
            className="min-w-[10rem]"
          />
        </div>
      </div>
      <Button variant="primary" onClick={onReset}>
        Reset <XIcon />
      </Button>
    </div>
  );
}
