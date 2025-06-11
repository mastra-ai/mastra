import { useForm } from 'react-hook-form';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export type LogsFilterFormInputs = {
  logLevel: 'all' | LogLevel;
  fromDate: string | null;
  toDate: string | null;
};

export const useLogsFilterForm = () => {
  return useForm<LogsFilterFormInputs>({
    defaultValues: {
      logLevel: 'all',
      fromDate: null,
      toDate: null,
    },
  });
};
