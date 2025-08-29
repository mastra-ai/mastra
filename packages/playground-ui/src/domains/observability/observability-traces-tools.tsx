import { SelectField, DateTimePicker } from '@/components/ui/elements';
import { Button } from '@/components/ui/elements/buttons';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';

export type EntityOptions = { value: string; label: string; type: 'agent' | 'workflow' };

type ObservabilityTracesToolsProps = {
  selectedEntity?: EntityOptions;
  entityOptions?: EntityOptions[];
  onEntityChange: (val: EntityOptions) => void;
  selectedDateFrom?: Date | undefined;
  selectedDateTo?: Date | undefined;
  onReset?: () => void;
  onDateChange?: (value: Date | undefined, type: 'from' | 'to') => void;
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
        onValueChange={val => {
          const entity = entityOptions?.find(entity => entity.value === val);
          if (entity) {
            onEntityChange(entity);
          }
        }}
        value={selectedEntity?.value || ''}
        className="min-w-[20rem]"
      />

      <div className={cn('flex gap-[1rem] items-center flex-wrap')}>
        <span className={cn('shrink-0 text-[0.875rem] text-icon3')}>Filter by Date & time range</span>
        <DateTimePicker
          placeholder="From"
          value={selectedDateFrom}
          onValueChange={date => onDateChange?.(date || undefined, 'from')}
          clearable={true}
          className="min-w-[15rem]"
          defaultTimeStrValue="12:00 AM"
        />
        <DateTimePicker
          placeholder="To"
          value={selectedDateTo}
          onValueChange={date => onDateChange?.(date || undefined, 'to')}
          clearable={true}
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
