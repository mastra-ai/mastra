import { ClockIcon } from 'lucide-react';
import { useRef } from 'react';

import { Input } from './input';
import type { InputProps } from './input';
import { mergeRefs } from '@/lib/merge-refs';
import { cn } from '@/lib/utils';

export type TimeInputProps = Omit<InputProps, 'type'>;

/**
 * `<input type="time">` with a design-system clock in place of the browser's picker
 * indicator, so the icon matches across themes and browsers (Firefox and Safari draw
 * none). Clicking the clock opens the native picker where the browser has one.
 *
 * `className` sizes the wrapper. The clock hides when the field is narrower than 6rem,
 * where it would clip a 12-hour value like "12:00 AM".
 */
function TimeInput({ className, ref, disabled, ...props }: TimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    try {
      input.showPicker?.();
    } catch {
      // Browsers without a time picker throw; focus alone leaves the field ready for typing.
    }
  };

  return (
    <div className={cn('@container/time-input relative w-full', className)}>
      <Input
        ref={mergeRefs(inputRef, ref)}
        type="time"
        disabled={disabled}
        className="pr-6 @max-[6rem]/time-input:pr-[.75em] [&::-webkit-calendar-picker-indicator]:hidden"
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        onClick={openPicker}
        className={cn(
          'absolute inset-y-0 right-2 my-auto grid size-4 place-items-center rounded-full text-muted-foreground',
          'hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
          '@max-[6rem]/time-input:hidden',
        )}
      >
        <ClockIcon className="size-3.5" />
      </button>
    </div>
  );
}

export { TimeInput };
