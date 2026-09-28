import type { SelectTriggerProps } from '../../Select/select';
import { FieldBlock } from '../block/field-block';
import type { FieldBlockProps } from '../block/field-block';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';

export type SelectFieldBlockProps = Omit<FieldBlockProps, 'children' | 'describedBy'> & {
  testId?: string;
  value?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  onValueChange: (value: string) => void;
  error?: boolean;
  size?: SelectTriggerProps['size'];
};

export function SelectFieldBlock({
  name,
  label,
  labelIsHidden,
  labelSize,
  layout,
  labelColumnWidth,
  required = false,
  disabled = false,
  helpText,
  error,
  errorMsg,
  className,
  testId,
  size = 'md',
  value,
  options,
  placeholder = 'Select an option',
  onValueChange,
}: SelectFieldBlockProps) {
  return (
    <FieldBlock
      name={name}
      label={label}
      labelIsHidden={labelIsHidden}
      labelSize={labelSize}
      layout={layout}
      labelColumnWidth={labelColumnWidth}
      required={required}
      disabled={disabled}
      helpText={helpText}
      errorMsg={errorMsg}
      className={className}
    >
      {control => (
        <Select name={name} value={value} onValueChange={onValueChange} disabled={disabled}>
          <SelectTrigger {...control} aria-invalid={error || control['aria-invalid']} data-testid={testId} size={size}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FieldBlock>
  );
}
