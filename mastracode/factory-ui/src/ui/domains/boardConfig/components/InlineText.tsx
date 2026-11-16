import { passwordManagerOptOutProps } from '@mastra/playground-ui/primitives/password-manager-autofill';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import type { TextStyleProps } from '@mastra/playground-ui/primitives/text';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useRef } from 'react';

/**
 * Text that is edited where it's shown. Edits reach the draft as they're typed, so the save bar and the leave guard see
 * them at once. Enter or Escape leaves the field, and Escape first puts back what it held when focused. Blur trims, and
 * a required text left empty goes back to what it was.
 */
export function InlineText({
  value,
  label,
  placeholder,
  required = false,
  multiline = false,
  readOnly,
  variant,
  tone,
  className,
  onChange,
}: {
  value: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  readOnly: boolean;
  variant: TextStyleProps['variant'];
  tone: TextStyleProps['tone'];
  className?: string;
  onChange: (value: string) => void;
}) {
  const atFocus = useRef(value);
  const restored = useRef(false);
  if (readOnly) return value ? <span className={className}>{value}</span> : null;

  const Field = multiline ? 'textarea' : 'input';
  const text = textStyle({ variant, tone });

  const field = (
    <Field
      aria-label={label}
      value={value}
      placeholder={placeholder}
      rows={multiline ? 1 : undefined}
      {...passwordManagerOptOutProps}
      onFocus={() => {
        atFocus.current = value;
      }}
      onChange={event => onChange(event.currentTarget.value)}
      onBlur={() => {
        if (restored.current) {
          restored.current = false;
          return;
        }
        const trimmed = value.trim();
        if (required && trimmed === '') onChange(atFocus.current);
        else if (trimmed !== value) onChange(trimmed);
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          restored.current = true;
          onChange(atFocus.current);
        }
        if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.blur();
        }
      }}
      className={cn(
        text,
        'placeholder:text-muted-foreground resize-none rounded-md bg-transparent px-1.5',
        multiline ? 'field-sizing-content -mx-1.5' : 'absolute inset-0 w-full min-w-0',
        'hover:bg-fill',
        focusRing,
        multiline && className,
      )}
    />
  );
  if (multiline) return field;

  // An input doesn't grow with its text in every browser, so a hidden copy of the text sizes it: the name stays whole,
  // and whatever sits beside it stays next to it.
  return (
    <span className={cn('relative -mx-1.5 inline-block max-w-[calc(100%+--spacing(3))] min-w-0', className)}>
      <span aria-hidden className={cn(text, 'invisible block overflow-hidden px-1.5 whitespace-pre')}>
        {value || placeholder || ' '}
      </span>
      {field}
    </span>
  );
}
