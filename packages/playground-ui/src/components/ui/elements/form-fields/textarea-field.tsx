import { cn } from '@/lib/utils';
import { TriangleAlertIcon } from 'lucide-react';
import * as React from 'react';

type TextareaFieldProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  testId?: string;
  label?: React.ReactNode;
  helpText?: string;
  error?: boolean;
  errorMsg?: string;
};

export function TextareaField({
  value,
  label,
  helpText,
  className,
  testId,
  disabled,
  error,
  errorMsg,
  ...props
}: TextareaFieldProps) {
  return (
    <div
      className={cn(
        'grid gap-[.5rem]  grid-rows-[auto_1fr]',
        {
          'grid-rows-[auto_1fr_auto]': helpText,
        },
        className,
      )}
    >
      {label && <label className={cn('text-[0.8125rem] text-icon3 flex justify-between items-center')}>{label}</label>}
      <textarea
        className={cn(
          'flex w-full items-center leading-[1.6] text-[0.875rem] text-[rgba(255,255,255,0.7)] border border-[rgba(255,255,255,0.15)] rounded-lg bg-transparent py-[0.5rem] px-[0.75rem] min-h-[6rem]',
          'focus:outline-none focus:shadow-[inset_0_0_0_1px_#18fb6f]',
          {
            'cursor-not-allowed opacity-50': disabled,
            'border-red-800 focus:border-[rgba(255,255,255,0.15)]': error || errorMsg,
          },
        )}
        value={value}
        {...props}
      />
      {helpText && <p className="text-icon3 text-[0.75rem]">{helpText}</p>}
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
