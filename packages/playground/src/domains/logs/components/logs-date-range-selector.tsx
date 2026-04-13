import { SelectFieldBlock } from '@mastra/playground-ui';

const DATE_PRESETS = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 3 days', value: '3d' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 14 days', value: '14d' },
  { label: 'Last 30 days', value: '30d' },
];

export type LogsDatePreset = (typeof DATE_PRESETS)[number]['value'];

export function isValidLogsDatePreset(value: string | null | undefined): value is LogsDatePreset {
  return DATE_PRESETS.some(p => p.value === value);
}

export interface LogsDateRangeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function LogsDateRangeSelector({ value, onChange }: LogsDateRangeSelectorProps) {
  return (
    <SelectFieldBlock
      name="logs-date-range"
      labelIsHidden
      value={value}
      options={DATE_PRESETS}
      onValueChange={onChange}
    />
  );
}
