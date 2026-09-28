import type { ReactNode } from 'react';
import { FieldBlockLabel } from './field-block-label';
import type { FieldBlockLabelProps } from './field-block-label';
import { FieldBlockMessage } from './field-block-message';
import { fieldErrorId } from './field-error-id';
import { cn } from '@/lib/utils';

export type FieldControlProps = {
  id: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
};

export type FieldBlockProps = {
  name: string;
  label?: ReactNode;
  labelIsHidden?: boolean;
  labelSize?: FieldBlockLabelProps['size'];
  layout?: 'vertical' | 'horizontal';
  /** Label column width in the horizontal layout, e.g. `150px` or `30%`. */
  labelColumnWidth?: string;
  required?: boolean;
  disabled?: boolean;
  helpText?: ReactNode;
  errorMsg?: ReactNode;
  /** Ids of other elements describing the control, read before the error message. */
  describedBy?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
};

export function FieldBlockRoot({
  name,
  label,
  labelIsHidden = false,
  labelSize,
  layout = 'vertical',
  labelColumnWidth,
  required = false,
  disabled = false,
  helpText,
  errorMsg,
  describedBy,
  className,
  children,
}: FieldBlockProps) {
  const isHorizontal = layout === 'horizontal';
  const hasLabelColumn = isHorizontal && Boolean(label);
  const hasVisibleLabelColumn = hasLabelColumn && !labelIsHidden;
  const labelId = label ? `label-${name}` : undefined;
  const ariaDescribedBy = [describedBy, errorMsg ? fieldErrorId(name) : undefined].filter(Boolean).join(' ');

  const control: FieldControlProps = {
    id: `input-${name}`,
    ...(labelId ? { 'aria-labelledby': labelId } : {}),
    ...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {}),
    ...(errorMsg ? { 'aria-invalid': true } : {}),
  };

  const fieldLabel = label ? (
    <FieldBlockLabel
      id={labelId}
      name={name}
      required={required}
      disabled={disabled}
      size={labelSize ?? (isHorizontal ? 'bigger' : 'default')}
      className={!isHorizontal && labelIsHidden ? 'sr-only' : undefined}
    >
      {label}
    </FieldBlockLabel>
  ) : null;

  return (
    <div
      className={cn(
        'relative grid gap-2 text-foreground',
        isHorizontal && 'grid-cols-[auto_1fr] items-baseline',
        className,
      )}
      style={isHorizontal && labelColumnWidth ? { gridTemplateColumns: `${labelColumnWidth} 1fr` } : undefined}
    >
      {hasLabelColumn ? <div className={cn('grid gap-2', labelIsHidden && 'sr-only')}>{fieldLabel}</div> : null}
      <div className={cn('grid gap-2', isHorizontal && !hasVisibleLabelColumn && 'col-span-full')}>
        {isHorizontal ? null : fieldLabel}
        <div className="grid gap-1">
          {children(control)}
          {helpText || errorMsg ? <FieldBlockMessage name={name} helpText={helpText} errorMsg={errorMsg} /> : null}
        </div>
      </div>
    </div>
  );
}
