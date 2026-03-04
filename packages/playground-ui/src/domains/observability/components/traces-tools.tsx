import { SelectField } from '@/ds/components/FormFields';
import { DateTimePicker } from '@/ds/components/DateTimePicker';
import { Button } from '@/ds/components/Button/Button';
import { XIcon } from 'lucide-react';
import { EntityType } from '@mastra/core/observability';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';

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
    <ButtonsGroup>
      <SelectField
        label="Filter by Entity"
        labelIsHidden={true}
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
        className="min-w-56"
        disabled={isLoading}
      />

      <DateTimePicker
        placeholder="Start date: Any"
        value={selectedDateFrom}
        maxValue={selectedDateTo}
        onValueChange={date => onDateChange?.(date, 'from')}
        className="min-w-48"
        defaultTimeStrValue="12:00 AM"
        disabled={isLoading}
      />
      <DateTimePicker
        placeholder="End date: Any"
        value={selectedDateTo}
        minValue={selectedDateFrom}
        onValueChange={date => onDateChange?.(date, 'to')}
        className="min-w-48"
        defaultTimeStrValue="11:59 PM"
        disabled={isLoading}
      />

      {(selectedDateFrom || selectedDateTo || (selectedEntity && selectedEntity.type !== 'all')) && (
        <Button onClick={onReset} disabled={isLoading}>
          <XIcon />
          Reset
        </Button>
      )}
    </ButtonsGroup>
  );
}
