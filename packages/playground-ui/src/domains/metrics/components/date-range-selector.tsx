import { useMetrics } from '../hooks/use-metrics';
import { SelectFieldBlock } from '@/ds/components/FormFieldBlocks/fields/select-field-block';

const DATE_PRESETS = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 3 days', value: '3d' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 14 days', value: '14d' },
  { label: 'Last 30 days', value: '30d' },
];

export function DateRangeSelector() {
  const { datePreset, setDatePreset } = useMetrics();

  return (
    <SelectFieldBlock
      name="date-range"
      labelIsHidden
      value={datePreset}
      options={DATE_PRESETS}
      onValueChange={value => setDatePreset(value as typeof datePreset)}
    />
  );
}
