import { SelectField } from '@/ds/components/FormFields';
import { DateTimePicker } from '@/ds/components/DateTimePicker';
import { Button } from '@/ds/components/Button/Button';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';
import { EntityType } from '@mastra/core/observability';
import { Icon } from '@/ds/icons/Icon';

// UI-specific entity options that map to API EntityType values
// Using the enum values (lowercase strings) for the type field
export type EntityOptions =
  | { value: string; label: string; type: EntityType.AGENT }
  | { value: string; label: string; type: EntityType.WORKFLOW_RUN }
  | { value: string; label: string; type: 'all' };

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
    <div className={cn('flex flex-wrap gap-x-8 gap-y-4')}>
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
      <div className={cn('flex gap-4 items-center flex-wrap')}>
        <span className={cn('shrink-0 text-ui-md text-neutral3')}>Filter by Date & time range</span>
        <DateTimePicker
          placeholder="From"
          value={selectedDateFrom}
          maxValue={selectedDateTo}
          onValueChange={date => onDateChange?.(date, 'from')}
          className="min-w-32"
          defaultTimeStrValue="12:00 AM"
          disabled={isLoading}
        />
        <DateTimePicker
          placeholder="To"
          value={selectedDateTo}
          minValue={selectedDateFrom}
          onValueChange={date => onDateChange?.(date, 'to')}
          className="min-w-32"
          defaultTimeStrValue="11:59 PM"
          disabled={isLoading}
        />

        <Button variant="light" size="lg" className="min-w-32" onClick={onReset} disabled={isLoading}>
          <Icon>
            <XIcon />
          </Icon>
          Reset
        </Button>
      </div>
    </div>
  );
}
