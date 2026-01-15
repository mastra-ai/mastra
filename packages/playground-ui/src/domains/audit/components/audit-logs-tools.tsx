import { SelectField } from '@/ds/components/FormFields';
import { DateTimePicker } from '@/ds/components/DateTimePicker';
import { Button } from '@/ds/components/Button/Button';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';
import { Icon } from '@/ds/icons/Icon';
import type { AuditEvent, AuditActor } from '@mastra/client-js';

export type ActorTypeOption = { value: AuditActor['type'] | 'all'; label: string };
export type OutcomeOption = { value: AuditEvent['outcome'] | 'all'; label: string };
export type ActionPrefixOption = { value: string; label: string };

export const actorTypeOptions: ActorTypeOption[] = [
  { value: 'all', label: 'All Actors' },
  { value: 'user', label: 'User' },
  { value: 'system', label: 'System' },
  { value: 'api-key', label: 'API Key' },
];

export const outcomeOptions: OutcomeOption[] = [
  { value: 'all', label: 'All Outcomes' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
  { value: 'denied', label: 'Denied' },
];

export const actionPrefixOptions: ActionPrefixOption[] = [
  { value: 'all', label: 'All Actions' },
  { value: 'auth.', label: 'Auth Events' },
  { value: 'agents.', label: 'Agent Events' },
  { value: 'workflows.', label: 'Workflow Events' },
  { value: 'tools.', label: 'Tool Events' },
];

export type AuditLogsToolsProps = {
  selectedActorType?: ActorTypeOption;
  selectedOutcome?: OutcomeOption;
  selectedActionPrefix?: ActionPrefixOption;
  selectedDateFrom?: Date | undefined;
  selectedDateTo?: Date | undefined;
  onActorTypeChange: (val: ActorTypeOption) => void;
  onOutcomeChange: (val: OutcomeOption) => void;
  onActionPrefixChange: (val: ActionPrefixOption) => void;
  onDateChange?: (value: Date | undefined, type: 'from' | 'to') => void;
  onReset?: () => void;
  isLoading?: boolean;
};

export function AuditLogsTools({
  selectedActorType,
  selectedOutcome,
  selectedActionPrefix,
  selectedDateFrom,
  selectedDateTo,
  onActorTypeChange,
  onOutcomeChange,
  onActionPrefixChange,
  onDateChange,
  onReset,
  isLoading,
}: AuditLogsToolsProps) {
  return (
    <div className={cn('flex flex-wrap gap-x-[1.5rem] gap-y-[1rem]')}>
      <SelectField
        label="Actor Type"
        name="select-actor-type"
        placeholder="Select..."
        options={actorTypeOptions}
        onValueChange={val => {
          const option = actorTypeOptions.find(o => o.value === val);
          if (option) {
            onActorTypeChange(option);
          }
        }}
        value={selectedActorType?.value || 'all'}
        className="min-w-[10rem]"
        disabled={isLoading}
      />
      <SelectField
        label="Action"
        name="select-action"
        placeholder="Select..."
        options={actionPrefixOptions}
        onValueChange={val => {
          const option = actionPrefixOptions.find(o => o.value === val);
          if (option) {
            onActionPrefixChange(option);
          }
        }}
        value={selectedActionPrefix?.value || 'all'}
        className="min-w-[10rem]"
        disabled={isLoading}
      />
      <SelectField
        label="Outcome"
        name="select-outcome"
        placeholder="Select..."
        options={outcomeOptions}
        onValueChange={val => {
          const option = outcomeOptions.find(o => o.value === val);
          if (option) {
            onOutcomeChange(option);
          }
        }}
        value={selectedOutcome?.value || 'all'}
        className="min-w-[10rem]"
        disabled={isLoading}
      />
      <div className={cn('flex gap-[1rem] items-center flex-wrap')}>
        <span className={cn('shrink-0 text-[0.875rem] text-neutral3')}>Date Range</span>
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
