import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Input } from '../../Input';
import type { InputProps } from '../../Input';
import { FieldBlock } from '../block/field-block';
import type { FieldBlockErrorMsgProps } from '../block/field-block-error-msg';
import type { FieldBlockHelpTextProps } from '../block/field-block-help-text';
import type { FieldBlockLabelProps } from '../block/field-block-label';
import type { FieldBlockLayoutProps } from '../block/field-block-layout';

export type TextFieldBlockProps = Pick<FieldBlockLayoutProps, 'layout' | 'labelColumnWidth'> &
  Omit<InputProps, 'name' | 'size'> & {
    name: string;
    labelIsHidden?: boolean;
    label?: FieldBlockLabelProps['children'];
    labelSize?: FieldBlockLabelProps['size'];
    helpText?: FieldBlockHelpTextProps['children'];
    errorMsg?: FieldBlockErrorMsgProps['children'];
    size?: InputProps['size'];
  };

export function TextFieldBlock({
  name,
  value,
  label,
  labelIsHidden = false,
  labelColumnWidth,
  helpText,
  errorMsg,
  required = false,
  disabled = false,
  labelSize,
  layout = 'vertical',
  placeholder,
  size = 'default',
  testId,
  className,
  ...props
}: TextFieldBlockProps) {
  return (
    <FieldBlock.Layout layout={layout} labelColumnWidth={labelColumnWidth} className={className}>
      {layout === 'horizontal' ? (
        <FieldBlock.Column>
          <FieldBlock.Label name={name} required={required} size={labelSize || 'bigger'}>
            {labelIsHidden ? <VisuallyHidden>{label}</VisuallyHidden> : label}
          </FieldBlock.Label>
        </FieldBlock.Column>
      ) : null}
      <FieldBlock.Column>
        {!labelIsHidden && layout === 'vertical' ? (
          <FieldBlock.Label name={name} required={required} size={labelSize || 'default'}>
            {label}
          </FieldBlock.Label>
        ) : null}
        <Input
          name={name}
          disabled={disabled}
          required={required}
          value={value}
          placeholder={placeholder}
          data-testid={testId}
          size={size}
          {...props}
        />
        {helpText && <FieldBlock.HelpText>{helpText}</FieldBlock.HelpText>}
        {errorMsg && <FieldBlock.ErrorMsg>{errorMsg}</FieldBlock.ErrorMsg>}
      </FieldBlock.Column>
    </FieldBlock.Layout>
  );
}
