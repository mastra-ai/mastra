import { Select as BaseSelect, SelectContent, SelectItem, SelectValue, SelectTrigger } from '@/ds/components/Select';

export interface SelectProps {
  name: string;
  onChange?: (value: string) => void;
  value?: string;
  options?: string[];
  placeholder?: string;
}

export function ElementSelect({ name, onChange, value, options, placeholder }: SelectProps) {
  return (
    <BaseSelect name={name} onValueChange={onChange} value={value}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder || 'Select...'} />
      </SelectTrigger>
      <SelectContent>
        {(options || []).map((option, idx) => (
          <SelectItem key={option} value={`${idx}`}>
            <div className="flex items-center gap-2 [&>svg]:w-[1.2em] [&>svg]:h-[1.2em] [&>svg]:text-neutral3">
              {option}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </BaseSelect>
  );
}
