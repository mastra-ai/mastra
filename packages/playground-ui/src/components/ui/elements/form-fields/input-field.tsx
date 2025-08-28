import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { TriangleAlertIcon } from 'lucide-react';
import * as React from 'react';

export type InputFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
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
  ...props
}: InputFieldProps) {
  const LabelWrapper = ({ children }: { children: React.ReactNode }) => {
    return labelIsHidden ? <VisuallyHidden>{children}</VisuallyHidden> : children;
  };

  return (
    <div
      className={cn(
        'grid gap-[.5rem] ',
        {
          'grid-rows-[auto_1fr]': !labelIsHidden && !helpMsg,
          'grid-rows-[auto_1fr_auto]': !labelIsHidden && helpMsg,
        },
        className,
      )}
    >
      <LabelWrapper>
        <label
          htmlFor={`input-${name}`}
          className={cn('text-[0.8125rem] text-icon3 flex justify-between items-center')}
        >
          {label}
          {required && <i className="text-icon2">(required)</i>}
        </label>
      </LabelWrapper>
      <input
        id={`input-${name}`}
        name={name}
        value={value}
        className={cn(
          'flex grow items-center cursor-pointer text-[0.875rem] text-[rgba(255,255,255,0.8)] border border-[rgba(255,255,255,0.15)] leading-none rounded-lg bg-transparent min-h-[2.5rem] px-[0.75rem] py-[0.5rem] w-full',
          'placeholder:text-icon3 placeholder:text-[.8125rem]',
          {
            'cursor-not-allowed opacity-50': disabled,
            'border-red-800': error || errorMsg,
          },
        )}
        data-testid={testId}
        {...props}
      />
      {helpMsg && <p className="text-icon3 text-[0.75rem]">{helpMsg}</p>}
      {errorMsg && (
        <p
          className={cn(
            'text-[0.75rem] text-icon4 flex items-center gap-[.5rem]',
            '[&>svg]:w-[1.2em] [&>svg]:h-[1.2em] [&>svg]:opacity-70 [&>svg]:text-red-400',
          )}
        >
          <TriangleAlertIcon /> {errorMsg}
        </p>
      )}
    </div>
  );
}
