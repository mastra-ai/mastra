import { SelectField, DateTimePicker } from '@/components/ui/elements';
import { Button } from '@/components/ui/elements/buttons';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';

export type EntityOptions = { value: string; label: string; type: 'agent' | 'workflow' | 'all' };

type TracesToolsProps = {
  selectedEntity?: EntityOptions;
  entityOptions?: EntityOptions[];
  onEntityChange: (val: EntityOptions) => void;
  selectedDateFrom?: Date | undefined;
  selectedDateTo?: Date | undefined;
  onReset?: () => void;
  onDateChange?: (value: Date | undefined, type: 'from' | 'to') => void;
  isLoading?: boolean;
};

export function TracesTools({
  onEntityChange,
  onReset,
  selectedEntity,
  entityOptions,
  onDateChange,
  selectedDateFrom,
  selectedDateTo,
  isLoading,
}: TracesToolsProps) {
  return (
    <div className={cn('flex flex-wrap gap-x-[2rem] gap-y-[1rem]')}>
      <SelectField
        label="Filter by Entity"
        name={'select-entity'}
        placeholder="Select..."
        options={entityOptions || []}
        onValueChange={val => {
          const entity = entityOptions?.find(entity => entity.value === val);
          if (entity) {
            onEntityChange(entity);
          }
        }}
        value={selectedEntity?.value || ''}
        className="min-w-[20rem]"
        disabled={isLoading}
      />
      <div className={cn('flex gap-[1rem] items-center flex-wrap mr-auto')}>
        <span className={cn('shrink-0 text-[0.875rem] text-icon3')}>Filter by Date & time range</span>
        <DateTimePicker
          placeholder="From"
          value={selectedDateFrom}
          maxValue={selectedDateTo}
          onValueChange={date => onDateChange?.(date, 'from')}
          className="min-w-[13rem]"
          defaultTimeStrValue="12:00 AM"
          disabled={isLoading}
        />
        <DateTimePicker
          placeholder="To"
          value={selectedDateTo}
          minValue={selectedDateFrom}
          onValueChange={date => onDateChange?.(date, 'to')}
          className="min-w-[13rem]"
          defaultTimeStrValue="11:59 PM"
          disabled={isLoading}
        />
      </div>
      <Button variant="primary" onClick={onReset} disabled={isLoading}>
        Reset <XIcon />
      </Button>
    </div>
  );
}
