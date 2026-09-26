import { PhoneInput } from '../../PhoneInput';
import type { PhoneInputProps } from '../../PhoneInput';
import { FieldBlock } from '../block/field-block';
import type { FieldBlockErrorMsgProps } from '../block/field-block-error-msg';
import type { FieldBlockHelpTextProps } from '../block/field-block-help-text';
import type { FieldBlockLabelProps } from '../block/field-block-label';
import type { FieldBlockLayoutProps } from '../block/field-block-layout';
import { fieldErrorId } from '../block/field-error-id';

export type PhoneFieldBlockProps = Pick<FieldBlockLayoutProps, 'layout' | 'labelColumnWidth'> &
  Omit<PhoneInputProps, 'id' | 'name'> & {
    name: string;
    labelIsHidden?: boolean;
    label?: FieldBlockLabelProps['children'];
    labelSize?: FieldBlockLabelProps['size'];
    helpText?: FieldBlockHelpTextProps['children'];
    errorMsg?: FieldBlockErrorMsgProps['children'];
  };

export function PhoneFieldBlock({
  name,
  label,
  labelIsHidden = false,
  labelColumnWidth,
  helpText,
  error,
  errorMsg,
  required = false,
  disabled = false,
  labelSize,
  layout = 'vertical',
  size = 'md',
  className,
  'aria-describedby': ariaDescribedBy,
  ...props
}: PhoneFieldBlockProps) {
  const describedBy =
    [ariaDescribedBy, errorMsg ? fieldErrorId(name) : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <FieldBlock.Layout layout={layout} labelColumnWidth={labelColumnWidth} className={className}>
      {layout === 'horizontal' && label ? (
        <FieldBlock.Column className={labelIsHidden ? 'sr-only' : undefined}>
          <FieldBlock.Label name={name} required={required} disabled={disabled} size={labelSize || 'bigger'}>
            {label}
          </FieldBlock.Label>
        </FieldBlock.Column>
      ) : null}
      <FieldBlock.Column className={layout === 'horizontal' && labelIsHidden ? 'col-span-full' : undefined}>
        {layout === 'vertical' && label ? (
          <FieldBlock.Label
            name={name}
            required={required}
            disabled={disabled}
            size={labelSize || 'default'}
            className={labelIsHidden ? 'sr-only' : undefined}
          >
            {label}
          </FieldBlock.Label>
        ) : null}
        <FieldBlock.Column className="gap-1">
          <PhoneInput
            {...props}
            id={`input-${name}`}
            name={name}
            disabled={disabled}
            required={required}
            size={size}
            error={error || Boolean(errorMsg)}
            aria-describedby={describedBy}
          />
          {helpText || errorMsg ? <FieldBlock.Message name={name} helpText={helpText} errorMsg={errorMsg} /> : null}
        </FieldBlock.Column>
      </FieldBlock.Column>
    </FieldBlock.Layout>
  );
}
