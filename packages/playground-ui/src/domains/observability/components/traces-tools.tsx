import { SelectField } from '@/ds/components/FormFields';
import { DateTimePicker } from '@/ds/components/DateTimePicker';
import { Button } from '@/ds/components/Button/Button';
import { IconButton } from '@/ds/components/IconButton/IconButton';
import { cn } from '@/lib/utils';
import { XIcon, CalendarIcon } from 'lucide-react';
import { EntityType } from '@mastra/core/observability';
import { Icon } from '@/ds/icons/Icon';
import { format } from 'date-fns';

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
        className="min-w-[12rem] [&_button]:bg-surface3 [&_button]:hover:bg-surface5"
        disabled={isLoading}
        size="sm"
      />
      <div className={cn('flex gap-2 items-center flex-wrap')}>
        <span className={cn('shrink-0 text-ui-sm text-neutral3')}>Filter by Date & time range</span>
        <DateTimePicker
          placeholder="From"
          value={selectedDateFrom}
          maxValue={selectedDateTo}
          onValueChange={date => onDateChange?.(date, 'from')}
          defaultTimeStrValue="12:00 AM"
          disabled={isLoading}
        >
          <Button className="justify-start" variant="light" size="sm" disabled={isLoading}>
            <Icon size="sm" className="mr-1">
              <CalendarIcon />
            </Icon>
            {selectedDateFrom ? (
              <span>{format(selectedDateFrom, 'PP p')}</span>
            ) : (
              <span className="text-neutral3">From</span>
            )}
          </Button>
        </DateTimePicker>
        <DateTimePicker
          placeholder="To"
          value={selectedDateTo}
          minValue={selectedDateFrom}
          onValueChange={date => onDateChange?.(date, 'to')}
          defaultTimeStrValue="11:59 PM"
          disabled={isLoading}
        >
          <Button className="justify-start" variant="light" size="sm" disabled={isLoading}>
            <Icon size="sm" className="mr-1">
              <CalendarIcon />
            </Icon>
            {selectedDateTo ? (
              <span>{format(selectedDateTo, 'PP p')}</span>
            ) : (
              <span className="text-neutral3">To</span>
            )}
          </Button>
        </DateTimePicker>

        {(selectedDateFrom || selectedDateTo) && (
          <IconButton variant="ghost" size="sm" onClick={onReset} disabled={isLoading} tooltip="Reset filters">
            <XIcon />
          </IconButton>
        )}
      </div>
    </div>
  );
}
