import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import type { SelectTriggerProps } from '../../Select/select';
import { FieldBlock } from '../block/field-block';
import type { FieldBlockErrorMsgProps } from '../block/field-block-error-msg';
import type { FieldBlockHelpTextProps } from '../block/field-block-help-text';
import type { FieldBlockLabelProps } from '../block/field-block-label';
import type { FieldBlockLayoutProps } from '../block/field-block-layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';

export type SelectFieldBlockProps = Pick<FieldBlockLayoutProps, 'layout' | 'labelColumnWidth'> &
  Pick<FieldBlockLabelProps, 'name' | 'required'> & {
    testId?: string;
    label?: string | null;
    labelIsHidden?: boolean;
    labelSize?: FieldBlockLabelProps['size'];
    disabled?: boolean;
    value?: string;
    options: { value: string; label: string }[];
    placeholder?: string;
    onValueChange: (value: string) => void;
    helpText?: FieldBlockHelpTextProps['children'];
    errorMsg?: FieldBlockErrorMsgProps['children'];
    error?: boolean;
    className?: string;
    size?: SelectTriggerProps['size'];
  };

export function SelectFieldBlock({
  name,
  helpText,
  errorMsg,
  required = false,
  disabled = false,
  size = 'default',
  value,
  label,
  labelIsHidden = false,
  layout = 'vertical',
  labelColumnWidth,
  options,
  placeholder = 'Select an option',
  onValueChange,
  className,
}: SelectFieldBlockProps) {
  return (
    <FieldBlock.Layout layout={layout} labelColumnWidth={labelColumnWidth} className={className}>
      {layout === 'horizontal' ? (
        <FieldBlock.Column>
          <FieldBlock.Label name={name} required={required}>
            {labelIsHidden ? <VisuallyHidden>{label}</VisuallyHidden> : label}
          </FieldBlock.Label>
        </FieldBlock.Column>
      ) : null}
      <FieldBlock.Column>
        {layout === 'vertical' && label && !labelIsHidden ? (
          <FieldBlock.Label name={name} required={required}>
            {label}
          </FieldBlock.Label>
        ) : null}
        <Select
          aria-label={labelIsHidden ? label : undefined}
          name={name}
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
        >
          <SelectTrigger size={size}>
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
        {helpText && <FieldBlock.HelpText>{helpText}</FieldBlock.HelpText>}
        {errorMsg && <FieldBlock.ErrorMsg>{errorMsg}</FieldBlock.ErrorMsg>}
      </FieldBlock.Column>
    </FieldBlock.Layout>
  );
}
