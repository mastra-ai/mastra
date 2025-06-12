import { ReactNode } from 'react';
import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from '../../components/ui/select';
import { DatePicker } from '../../components/ui/date-picker';
import { addDays, subHours, subDays, subMinutes } from 'date-fns';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export type LogsFiltersFormInputs = {
  logLevel: LogLevel | 'all';
  dateRange:
    | { type: 'none' }
    | {
        type: 'relative';
        interval: '30min' | '1h' | '1d';
      }
    | {
        type: 'absolute';
        fromDate: Date | undefined;
        toDate: Date | undefined;
      };
};

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

const dateRangeOptions = [
  {
    label: 'All time',
    value: 'none',
  },
  {
    label: 'Last 30 minutes',
    value: '30min',
  },
  {
    label: 'Last 1 hour',
    value: '1h',
  },
  {
    label: 'Last 1 day',
    value: '1d',
  },
  {
    label: 'Custom',
    value: 'absolute',
  },
] as const;

export const generateFromToDate = (dateRange: LogsFiltersFormInputs['dateRange']) => {
  if (dateRange.type === 'absolute') {
    return {
      fromDate: dateRange.fromDate,
      // this needs to be end-inclusive, so we add 1 day
      toDate: dateRange.toDate ? addDays(dateRange.toDate, 1) : undefined,
    };
  } else if (dateRange.type === 'relative') {
    const now = new Date();

    const fromDateMatcher = {
      '30min': () => subMinutes(now, 30),
      '1h': () => subHours(now, 1),
      '1d': () => subDays(now, 1),
    }[dateRange.interval];

    return {
      fromDate: fromDateMatcher(),
      toDate: undefined,
    };
  }
  return { fromDate: undefined, toDate: undefined };
};

export const LogsFiltersForm = ({
  value,
  onChange,
}: {
  value: LogsFiltersFormInputs;
  onChange: (state: LogsFiltersFormInputs) => void;
}) => {
  const handleChangeDateRange = (inputValue: (typeof dateRangeOptions)[number]['value']) => {
    if (inputValue === 'none') {
      onChange({ ...value, dateRange: { type: 'none' } });
    } else if (inputValue === 'absolute') {
      onChange({ ...value, dateRange: { type: 'absolute', fromDate: undefined, toDate: undefined } });
    } else {
      onChange({ ...value, dateRange: { type: 'relative', interval: inputValue } });
    }
  };

  return (
    <div className="w-[200px] shrink-0 border-r-sm border-border1 bg-surface2 p-2 space-y-2">
      <FormInput label="Log level">
        <Select
          value={value.logLevel}
          onValueChange={logLevel => onChange({ ...value, logLevel: logLevel as LogLevel })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {logLevelOptions.map(option => (
              <SelectItem key={option.value} value={option.value} className="text-white">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormInput>

      <FormInput label="Date range">
        <Select
          value={value.dateRange?.type === 'relative' ? value.dateRange.interval : value.dateRange.type}
          onValueChange={handleChangeDateRange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {dateRangeOptions.map(option => (
              <SelectItem key={option.value} value={option.value} className="text-white">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormInput>

      {value.dateRange.type === 'absolute' ? (
        <>
          <FormInput label="From Date">
            <DatePicker
              value={value.dateRange.fromDate ? new Date(value.dateRange.fromDate) : undefined}
              setValue={date => {
                // practical invariant
                if (value.dateRange.type !== 'absolute') {
                  return;
                }
                onChange({ ...value, dateRange: { ...value.dateRange, fromDate: date ?? undefined } });
              }}
              clearable
            />
          </FormInput>

          <FormInput label="To Date">
            <DatePicker
              value={value.dateRange.toDate}
              setValue={date => {
                // practical invariant
                if (value.dateRange.type !== 'absolute') {
                  return;
                }
                onChange({ ...value, dateRange: { ...value.dateRange, toDate: date ?? undefined } });
              }}
              clearable
            />
          </FormInput>
        </>
      ) : null}
    </div>
  );
};
