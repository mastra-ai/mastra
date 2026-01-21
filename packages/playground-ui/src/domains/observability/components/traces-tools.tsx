import { InputField, SelectField } from '@/ds/components/FormFields';
import { DateTimePicker } from '@/ds/components/DateTimePicker';
import { Button } from '@/ds/components/Button/Button';
import { cn } from '@/lib/utils';
import { ChevronDownIcon, XIcon } from 'lucide-react';
import { EntityType, SpanType } from '@mastra/core/observability';
import { Icon } from '@/ds/icons/Icon';
import { useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { TraceStatus } from '@mastra/core/storage';

// UI-specific entity options that map to API EntityType values
// Using the enum values (lowercase strings) for the type field
export type EntityOptions =
  | { value: string; label: string; type: EntityType.AGENT }
  | { value: string; label: string; type: EntityType.WORKFLOW_RUN }
  | { value: string; label: string; type: 'all' };

export type SpanTypeOptions = { value: SpanType | 'all'; label: string };

export type StatusOptions = { value: TraceStatus | 'all'; label: string };

type TracesToolsProps = {
  selectedEntity?: EntityOptions;
  selectedType?: SpanType | 'all';
  selectedDateFrom?: Date | undefined;
  selectedDateTo?: Date | undefined;
  selectedStatus?: TraceStatus | 'all';
  selectedRunId?: string;
  onEntityChange: (val: EntityOptions) => void;
  onDateChange: (value: Date | undefined, type: 'from' | 'to') => void;
  onRunIdChange: (runId: string) => void;
  onStatusChange: (status: TraceStatus | 'all') => void;
  onTypeChange: (type: SpanType | 'all') => void;
  onReset?: () => void;
  onMinimize?: () => void;
  entityOptions?: EntityOptions[];
  spanTypeOptions?: SpanTypeOptions[];
  statusOptions?: StatusOptions[];
  isLoading?: boolean;
};

export function TracesTools({
  selectedEntity = { value: 'all', label: 'All', type: 'all' },
  selectedType = 'all',
  selectedStatus = 'all',
  selectedRunId,
  selectedDateFrom,
  selectedDateTo,
  onEntityChange,
  onDateChange,
  onTypeChange,
  onStatusChange,
  onRunIdChange,
  onReset,
  onMinimize,
  entityOptions,
  spanTypeOptions,
  statusOptions,
  isLoading,
}: TracesToolsProps) {
  const [allFiltersVisible, setAllFiltersVisible] = useState(false);

  useEffect(() => {
    if (selectedRunId && !allFiltersVisible) {
      setAllFiltersVisible(true);
    }
  }, [allFiltersVisible, setAllFiltersVisible, selectedRunId]);

  const filterApplied =
    selectedEntity?.value !== 'all' ||
    selectedDateFrom ||
    selectedDateTo ||
    selectedType !== 'all' ||
    selectedStatus !== 'all' ||
    !!selectedRunId;

  return (
    <div
      className={cn('grid grid-cols-[auto_1fr] flex-wrap gap-x-6 gap-y-4 border border-border1 p-5 rounded-lg mb-4')}
    >
      <h3 className="text-neutral4 pt-2 uppercase text-ui-md border-r !border-dashed border-border1 pr-6 pl-3">
        Filter by:
      </h3>
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-4">
          <SelectField
            label="Entity"
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
            className="min-w-64"
            disabled={isLoading}
          />

          <div className={cn('flex gap-4 items-center flex-wrap')}>
            <span className={cn('shrink-0 text-ui-md text-neutral3')}>Date & Time range</span>
            <DateTimePicker
              placeholder="From"
              value={selectedDateFrom}
              maxValue={selectedDateTo}
              onValueChange={date => onDateChange?.(date, 'from')}
              defaultTimeStrValue="12:00 AM"
              disabled={isLoading}
            />
            <DateTimePicker
              placeholder="To"
              value={selectedDateTo}
              minValue={selectedDateFrom}
              onValueChange={date => onDateChange?.(date, 'to')}
              defaultTimeStrValue="11:59 PM"
              disabled={isLoading}
            />
          </div>
        </div>

        {allFiltersVisible && (
          <div className="flex flex-wrap gap-4 ">
            <SelectField
              label="Trace type"
              name={'select-span-type'}
              placeholder="Select..."
              options={spanTypeOptions || []}
              onValueChange={val => {
                onTypeChange(val as SpanType | 'all');
              }}
              value={selectedType}
              className="min-w-48"
              disabled={isLoading}
            />

            <SelectField
              label="Status"
              name={'status'}
              placeholder="Select..."
              options={statusOptions || []}
              onValueChange={val => {
                onStatusChange(val as TraceStatus | 'all');
              }}
              value={selectedStatus}
              className="min-w-48"
              disabled={isLoading}
            />

            <InputField
              label="Run Id"
              name="run-id"
              placeholder="..."
              disabled={isLoading}
              layout="horizontal"
              value={selectedRunId}
              className="min-w-[23rem]"
              onChange={e => onRunIdChange(e.target.value)}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-4 justify-between">
          <Button
            size="lg"
            onClick={onReset}
            onClickCapture={() => {
              if (onMinimize && allFiltersVisible) {
                onMinimize();
              }
              setAllFiltersVisible(!allFiltersVisible);
            }}
          >
            <Icon>
              <ChevronDownIcon
                className={cn({
                  'rotate-180': allFiltersVisible,
                })}
              />
            </Icon>
            {allFiltersVisible ? 'Less Filters' : 'More Filters'}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="lg" onClick={onReset} disabled={isLoading || !filterApplied}>
                <Icon>
                  <XIcon />
                </Icon>
                Reset All Filters
              </Button>
            </TooltipTrigger>
            {filterApplied ? null : <TooltipContent>{'There are no filters to reset.'}</TooltipContent>}
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
