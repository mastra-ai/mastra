import { cn } from '@/lib/utils';
import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectTrigger,
  SelectTriggerProps,
} from '@/ds/components/Select';
import { type FormElementSize } from '@/ds/primitives/form-element';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

export type SelectFieldProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  name?: string;
  testId?: string;
  label?: React.ReactNode;
  labelIsHidden?: boolean;
  required?: boolean;
  disabled?: boolean;
  value?: string;
  helpMsg?: string;
  errorMsg?: string;
  options: { value: string; label: React.ReactNode; icon?: React.ReactNode; disabled?: boolean }[];
  placeholder?: string;
  onValueChange: (value: string) => void;
  size?: FormElementSize | 'default';
  variant?: SelectTriggerProps['variant'];
};

export function SelectField({
  name,
  value,
  label,
  labelIsHidden = false,
  className,
  required,
  disabled,
  helpMsg,
  options,
  onValueChange,
  placeholder = 'Select an option',
  size = 'lg',
  variant = 'default',
}: SelectFieldProps) {
  const LabelWrapper = ({ children }: { children: React.ReactNode }) => {
    return labelIsHidden ? <VisuallyHidden>{children}</VisuallyHidden> : children;
  };

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
      <LabelWrapper>
        <label className={cn('text-ui-sm text-neutral3 flex justify-between items-center shrink-0')}>
          {label}
          {required && <i className="text-neutral2">(required)</i>}
        </label>
      </LabelWrapper>
      <Select name={name} value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={`select-${name}`}
          size={size}
          variant={variant}
          className="grid grid-cols-[1fr_auto] [&>span]:truncate"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              <span className="whitespace-nowrap truncate flex items-center gap-2">
                {option.icon}
                {option.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {helpMsg && <p className="text-neutral3 text-ui-sm">{helpMsg}</p>}
    </div>
  );
}
