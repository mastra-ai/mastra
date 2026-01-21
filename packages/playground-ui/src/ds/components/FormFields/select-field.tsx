import { cn } from '@/lib/utils';
import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from '@/ds/components/Select';
import { formElementFocus, formElementRadius, type FormElementSize } from '@/ds/primitives/form-element';

export type SelectFieldProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  name?: string;
  testId?: string;
  label?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  value?: string;
  helpMsg?: string;
  errorMsg?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  onValueChange: (value: string) => void;
  size?: FormElementSize;
};

export function SelectField({
  name,
  value,
  label,
  className,
  required,
  disabled,
  helpMsg,
  options,
  onValueChange,
  placeholder = 'Select an option',
  size = 'lg',
}: SelectFieldProps) {
  return (
    <div
      className={cn(
        'flex gap-2 items-center',
        {
          'grid-rows-[auto_1fr]': label,
          'grid-rows-[auto_1fr_auto]': helpMsg,
        },
        className,
      )}
    >
      {label && (
        <label
          htmlFor={`select-${name}`}
          className={cn('text-ui-md text-neutral3 flex justify-between items-center shrink-0 ')}
        >
          {label}
          {required && <i className="text-neutral2">(required)</i>}
        </label>
      )}
      <Select name={name} value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={`select-${name}`}
          size={size}
          className={cn('w-full border border-border1 min-w-20 gap-2', formElementRadius, formElementFocus)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.label} value={option.value}>
              <span className="whitespace-nowrap truncate block">{option.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {helpMsg && <p className="text-neutral3 text-ui-sm">{helpMsg}</p>}
    </div>
  );
}
