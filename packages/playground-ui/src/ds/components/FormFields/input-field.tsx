import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { TriangleAlertIcon } from 'lucide-react';
import * as React from 'react';
import {
  formElementSizes,
  formElementFocus,
  formElementRadius,
  type FormElementSize,
} from '@/ds/primitives/form-element';

export type InputFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  name: string;
  testId?: string;
  label?: string;
  labelIsHidden?: boolean;
  required?: boolean;
  disabled?: boolean;
  value?: string;
  helpMsg?: string;
  error?: boolean;
  errorMsg?: string;
  size?: FormElementSize;
  layout?: 'vertical' | 'horizontal';
};

const inputFieldSizeClasses = {
  sm: `${formElementSizes.sm} px-2`,
  md: `${formElementSizes.md} px-3`,
  lg: `${formElementSizes.lg} px-3 py-2`,
};

export function InputField({
  name,
  value,
  label,
  labelIsHidden = false,
  className,
  testId,
  required,
  disabled,
  helpMsg,
  error,
  errorMsg,
  size = 'lg',
  layout = 'vertical',
  ...props
}: InputFieldProps) {
  const LabelWrapper = ({ children }: { children: React.ReactNode }) => {
    return labelIsHidden ? <VisuallyHidden>{children}</VisuallyHidden> : children;
  };

  return (
    <div
      className={cn(
        'grid gap-2',
        {
          'grid-cols-[auto_1fr]': layout === 'horizontal',
        },
        className,
      )}
    >
      <LabelWrapper>
        <label
          htmlFor={`input-${name}`}
          className={cn('text-ui-sm text-neutral3 flex justify-between items-center', {
            'text-ui-md': layout === 'horizontal',
          })}
        >
          {label}
          {required && <i className="text-neutral2 text-xs">(required)</i>}
        </label>
      </LabelWrapper>
      <div className="flex flex-col gap-1">
        <input
          id={`input-${name}`}
          name={name}
          value={value}
          className={cn(
            'flex grow items-center cursor-pointer text-ui-md text-neutral5 border border-border1 leading-none bg-transparent w-full',
            formElementRadius,
            formElementFocus,
            inputFieldSizeClasses[size],
            'placeholder:text-neutral3 placeholder:text-ui-sm',
            {
              'cursor-not-allowed opacity-50': disabled,
              'border-red-800 focus:border-border1': error || errorMsg,
            },
          )}
          data-testid={testId}
          {...props}
        />
        {helpMsg && <p className="text-neutral3 text-ui-sm">{helpMsg}</p>}
        {errorMsg && (
          <p
            className={cn(
              'text-ui-sm text-neutral4 flex items-center gap-2',
              '[&>svg]:w-[1.2em] [&>svg]:h-[1.2em] [&>svg]:opacity-70 [&>svg]:text-red-400',
            )}
          >
            <TriangleAlertIcon /> {errorMsg}
          </p>
        )}
      </div>
    </div>
  );
}
