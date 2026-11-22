import { useState } from 'react';

import { Input } from '@/ds/components/Input';
import { toast } from '@/ds/components/Toaster';
import { cn } from '@/lib/utils';

export interface CommittedInputProps {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  type?: 'text' | 'number';
  mono?: boolean;
  min?: number;
  max?: number;
  step?: number | 'any';
  className?: string;
  onCommit: (value: string) => Promise<unknown>;
}

/**
 * A text or number input that keeps a local draft and commits it on blur or
 * Enter, only when the trimmed value differs from the stored one. The draft is
 * dropped once the commit resolves, so the stored value shows again.
 */
export function CommittedInput({
  label,
  value,
  placeholder,
  disabled,
  type = 'text',
  mono = type === 'text',
  min,
  max,
  step,
  className,
  onCommit,
}: CommittedInputProps) {
  const [draft, setDraft] = useState<string>();
  const current = draft ?? value;

  const commit = (input: HTMLInputElement) => {
    // A number input reports '' while its text is not a number ("-", "1e");
    // treating that as "clear the setting" would silently drop a stored value.
    if (input.validity?.badInput) {
      toast.error('Enter a number');
      return;
    }
    if (current.trim() === value) {
      setDraft(undefined);
      return;
    }
    onCommit(current.trim()).then(
      () => setDraft(undefined),
      () => {},
    );
  };

  return (
    <Input
      className={cn(mono && 'font-mono', className) || undefined}
      size="sm"
      type={type}
      min={min}
      max={max}
      step={step}
      aria-label={label}
      placeholder={placeholder}
      value={current}
      disabled={disabled}
      onChange={event => setDraft(event.target.value)}
      onBlur={event => commit(event.currentTarget)}
      onKeyDown={event => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}
