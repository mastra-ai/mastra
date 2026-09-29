import { Textarea } from '../../Textarea';
import type { TextareaProps } from '../../Textarea';
import { FieldBlock } from '../block/field-block';
import type { FieldBlockErrorMsgProps } from '../block/field-block-error-msg';
import type { FieldBlockHelpTextProps } from '../block/field-block-help-text';
import type { FieldBlockLabelProps } from '../block/field-block-label';
import type { FieldBlockLayoutProps } from '../block/field-block-layout';
import { fieldErrorId } from '../block/field-error-id';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';

export type TextareaFieldBlockProps = Pick<FieldBlockLayoutProps, 'layout' | 'labelColumnWidth'> &
  Omit<TextareaProps, 'name' | 'size'> & {
    name: string;
    labelIsHidden?: boolean;
    label?: FieldBlockLabelProps['children'];
    labelSize?: FieldBlockLabelProps['size'];
    helpText?: FieldBlockHelpTextProps['children'];
    errorMsg?: FieldBlockErrorMsgProps['children'];
    size?: TextareaProps['size'];
  };

export function TextareaFieldBlock({
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
  testId,
  className,
  'aria-describedby': ariaDescribedBy,
  ...props
}: TextareaFieldBlockProps) {
  const describedBy =
    [ariaDescribedBy, errorMsg ? fieldErrorId(name) : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <FieldBlock.Layout layout={layout} labelColumnWidth={labelColumnWidth} className={className}>
      {layout === 'horizontal' ? (
        <FieldBlock.Column>
          <FieldBlock.Label name={name} required={required} disabled={disabled} size={labelSize || 'bigger'}>
            {labelIsHidden ? <VisuallyHidden>{label}</VisuallyHidden> : label}
          </FieldBlock.Label>
        </FieldBlock.Column>
      ) : null}
      <FieldBlock.Column>
        {!labelIsHidden && layout === 'vertical' ? (
          <FieldBlock.Label name={name} required={required} disabled={disabled} size={labelSize || 'default'}>
            {label}
          </FieldBlock.Label>
        ) : null}
        <FieldBlock.Column className="gap-1">
          <Textarea
            id={`input-${name}`}
            name={name}
            disabled={disabled}
            required={required}
            size={size}
            data-testid={testId}
            error={error || Boolean(errorMsg)}
            aria-describedby={describedBy}
            {...props}
          />
          {helpText || errorMsg ? <FieldBlock.Message name={name} helpText={helpText} errorMsg={errorMsg} /> : null}
        </FieldBlock.Column>
      </FieldBlock.Column>
    </FieldBlock.Layout>
  );
}
