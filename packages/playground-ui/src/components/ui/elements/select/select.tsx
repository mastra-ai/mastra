'use client';

import { Select as BaseSelect, SelectContent, SelectItem, SelectValue, SelectTrigger } from '@/components/ui/select';

type SelectOption = {
  label: string;
  value: string;
};

type SelectProps = {
  name: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
  value?: string;
  options?: string[];
  placeholder?: string;
};

export function Select({ name, onChange, defaultValue, value, options, placeholder }: SelectProps) {
  return (
    <BaseSelect name={name} onValueChange={onChange} value={value}>
      <SelectTrigger>
        <SelectValue defaultValue="0" />
      </SelectTrigger>
      <SelectContent>
        {(options || []).map((option, idx) => (
          <SelectItem key={option} value={`${idx}`}>
            <div className="flex items-center gap-[0.5rem] [&>svg]:w-[1.2em] [&>svg]:h-[1.2em] [&>svg]:text-icon3">
              {option}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </BaseSelect>
  );
}
