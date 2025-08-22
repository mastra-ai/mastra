import { cn } from '@/lib/utils';
import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from '@/components/ui/select';

type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
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
}: SelectFieldProps) {
  return (
    <div
      className={cn(
        'flex gap-[.5rem]',
        {
          'grid-rows-[auto_1fr]': label,
          'grid-rows-[auto_1fr_auto]': helpMsg,
        },
        className,
      )}
    >
      {label && (
        <label className={cn('text-[0.8125rem] text-icon3 flex justify-between items-center shrink-0')}>
          {label}
          {required && <i className="text-icon2">(required)</i>}
        </label>
      )}
      <Select name={name} value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id="select-dataset"
          className={cn(
            'w-full border border-[rgba(255,255,255,0.15)] rounded-lg min-h-[2.5rem] min-w-[5rem] gap-[0.5rem]',
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.label} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {helpMsg && <p className="text-icon3 text-[0.75rem]">{helpMsg}</p>}
    </div>
  );
}
