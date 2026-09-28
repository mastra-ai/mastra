import { Input } from '../../Input';
import type { InputProps } from '../../Input';
import { FieldBlock } from '../block/field-block';
import type { FieldBlockProps } from '../block/field-block';

export type TextFieldBlockProps = Omit<FieldBlockProps, 'children' | 'describedBy'> &
  Omit<InputProps, 'name' | 'size' | 'id'> & {
    size?: InputProps['size'];
  };

export function TextFieldBlock({
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
  size = 'md',
  testId,
  className,
  'aria-describedby': describedBy,
  ...inputProps
}: TextFieldBlockProps) {
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
      describedBy={describedBy}
      className={className}
    >
      {control => (
        <Input
          {...inputProps}
          {...control}
          name={name}
          disabled={disabled}
          required={required}
          data-testid={testId}
          size={size}
          error={error || Boolean(errorMsg)}
        />
      )}
    </FieldBlock>
  );
}
