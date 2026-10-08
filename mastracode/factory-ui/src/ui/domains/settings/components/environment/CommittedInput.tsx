import { Input } from '@mastra/playground-ui/components/Input';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { useState } from 'react';

import type { FactoryEnvironmentPatch } from '../../../workspaces/services/environment';

/** Persists one environment change; resolves to whether it saved (failures are toasted by the caller). */
export type SaveEnvironment = (input: FactoryEnvironmentPatch) => Promise<boolean>;

/**
 * A whole number within [min, max], or undefined after telling the user why
 * the value was not saved. `Number()` rejects "1.5" and "12abc" where parseInt
 * would have silently truncated them.
 */
export function wholeNumber(raw: string, min: number, max: number): number | undefined {
  const value = Number(raw);
  if (Number.isInteger(value) && value >= min && value <= max) return value;
  toast.error(`Enter a whole number between ${min} and ${max}`);
  return undefined;
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
  className,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  type?: 'text' | 'number';
  mono?: boolean;
  min?: number;
  max?: number;
  className?: string;
  onCommit: (value: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<string>();
  const current = draft ?? value;

  const commit = () => {
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
      className={[mono ? 'font-mono' : '', className ?? ''].join(' ').trim() || undefined}
      size="sm"
      type={type}
      min={min}
      max={max}
      aria-label={label}
      placeholder={placeholder}
      value={current}
      disabled={disabled}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}
