import { Textarea } from '../../Textarea';
import type { TextareaProps } from '../../Textarea';
import { FieldBlock } from '../block/field-block';
import type { FieldBlockProps } from '../block/field-block';

export type TextareaFieldBlockProps = Omit<FieldBlockProps, 'children' | 'describedBy'> &
  Omit<TextareaProps, 'name' | 'size' | 'id'> & {
    size?: TextareaProps['size'];
  };

export function TextareaFieldBlock({
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
  ...textareaProps
}: TextareaFieldBlockProps) {
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
        <Textarea
          {...textareaProps}
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
