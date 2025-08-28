import { cn } from '@/lib/utils';
import * as React from 'react';

type TextareaFieldProps = React.InputHTMLAttributes<HTMLTextAreaElement> & {
  testId?: string;
  label?: React.ReactNode;
  helpText?: string;
  value?: string;
  disabled?: boolean;
  className?: string;
};

export function TextareaField({
  value,
  label,
  helpText,
  className,
  testId,
  type,
  disabled,
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
          { 'cursor-not-allowed opacity-50': disabled },
        )}
        data-testid={testId}
        {...props}
      >
        {value}
      </textarea>
      {helpText && <p className="text-icon3 text-[0.75rem]">{helpText}</p>}
    </div>
  );
}
