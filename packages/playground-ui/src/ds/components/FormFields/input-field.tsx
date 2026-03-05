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
  name?: string;
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
  variant?: 'default' | 'experimental';
};

const inputFieldSizeClasses = {
  sm: `${formElementSizes.sm} px-2`,
  md: `${formElementSizes.md} px-3`,
  lg: `${formElementSizes.lg} px-3 py-2`,
  default: `${formElementSizes.default} px-3`,
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
  variant = 'default',
  ...props
}: InputFieldProps) {
  const LabelWrapper = ({ children }: { children: React.ReactNode }) => {
    return labelIsHidden ? <VisuallyHidden>{children}</VisuallyHidden> : children;
  };

  const isExperimentalVariant = variant === 'experimental';

  return (
    <div
      className={cn(
        'grid gap-2 text-neutral4',
        {
          'grid-rows-[auto_1fr]': !labelIsHidden && !helpMsg,
          'grid-rows-[auto_1fr_auto]': !labelIsHidden && helpMsg,
        },
        className,
      )}
    >
      <LabelWrapper>
        <label htmlFor={`input-${name}`} className={cn('text-ui-sm text-neutral3 flex justify-between items-center')}>
          {label}
          {required && <i className="text-neutral2 text-xs">(required)</i>}
        </label>
      </LabelWrapper>

      <input
        id={`input-${name}`}
        name={name}
        value={value}
        autoComplete="off"
        className={cn(
          'flex grow items-center cursor-pointer text-ui-md leading-none',
          inputFieldSizeClasses[size],
          isExperimentalVariant
            ? 'text-neutral4 leading-[10] ring-2 ring-inset ring-white/20 bg-surface2 hover:ring-white/30 focus-visible:ring-accent1/60 px-[1em] rounded-lg transition-colors duration-200 ease-out-custom [&:-webkit-autofill]:bg-surface2'
            : 'text-neutral5 border border-border1 bg-transparent w-full',
          isExperimentalVariant ? 'focus-visible:outline-none' : formElementFocus,
          isExperimentalVariant ? '' : formElementRadius,
          isExperimentalVariant ? 'placeholder:text-neutral2' : 'placeholder:text-neutral3 placeholder:text-ui-sm',
          {
            'cursor-not-allowed opacity-50': disabled,
            'border-red-800 focus:border-border1': !isExperimentalVariant && (error || errorMsg),
          },
        )}
        data-testid={testId}
        //  style={{ lineHeight: '10' }}
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
  );
}
