import { Control } from 'react-hook-form';
import { LogsFilterFormInputs } from './useLogsFilterForm';
import { ReactNode } from 'react';
import { DateField, EnumField } from '@/components/dynamic-form/fields';

const FormInput = ({ label, children }: { label: string; children: ReactNode }) => {
  return (
    <div className="flex flex-col items-stretch gap-y-1">
      <div className="text-ui-sm text-icon3">{label}</div>
      {children}
    </div>
  );
};

const logLevelOptions = [
  {
    label: 'All',
    value: 'all',
  },
  {
    label: 'Debug',
    value: 'debug',
  },
  {
    label: 'Info',
    value: 'info',
  },
  {
    label: 'Warn',
    value: 'warn',
  },
  {
    label: 'Error',
    value: 'error',
  },
  {
    label: 'Silent',
    value: 'silent',
  },
];

export const FiltersForm = ({ control }: { control: Control<LogsFilterFormInputs> }) => {
  return (
    <div className="w-[200px] shrink-0 border-r-sm border-border1 bg-surface2 p-2 space-y-2">
      <FormInput label="Log level">
        <EnumField name="logLevel" control={control} options={logLevelOptions} />
      </FormInput>

      <FormInput label="From Date">
        <DateField name="fromDate" control={control} />
      </FormInput>

      <FormInput label="To Date">
        <DateField name="toDate" control={control} />
      </FormInput>
    </div>
  );
};
