import { SelectFieldBlock } from '../../../ds/components/FormFieldBlocks';
import { DATE_PRESETS, isValidPreset, useMetrics } from '../hooks/use-metrics';

export function DateRangeSelector() {
  const { datePreset, setDatePreset } = useMetrics();

  return (
    <SelectFieldBlock
      name="date-range"
      labelIsHidden
      value={datePreset}
      options={DATE_PRESETS.map(p => ({ label: p.label, value: p.value }))}
      onValueChange={value => {
        if (isValidPreset(value)) setDatePreset(value);
      }}
    />
  );
}
