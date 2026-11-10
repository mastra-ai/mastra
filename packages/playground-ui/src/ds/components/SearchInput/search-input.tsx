import { useRef } from 'react';
import type { Ref } from 'react';
import { Field, FieldLabel } from '@/ds/components/Field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/ds/components/InputGroup';
import type { InputGroupInputProps, InputGroupProps } from '@/ds/components/InputGroup';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';
import { IconMagnifyingGlass } from '@/ds/icons/central/IconMagnifyingGlass';
import { mergeRefs } from '@/lib/merge-refs';

export type SearchInputProps = Omit<InputGroupInputProps, 'value' | 'onChange' | 'type' | 'ref' | 'error'> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onClose?: () => void;
  size?: InputGroupProps['size'];
  className?: string;
  ref?: Ref<HTMLInputElement>;
};

export function SearchInput({
  label,
  value,
  onValueChange,
  onClose,
  size,
  className,
  ref,
  ...inputProps
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const clear = () => {
    onValueChange('');
    inputRef.current?.focus();
  };

  const close = () => {
    onValueChange('');
    onClose?.();
  };

  return (
    <Field className={className}>
      <FieldLabel className="sr-only">{label}</FieldLabel>
      <InputGroup size={size} className="min-w-0">
        {/* Spaced like a Button's leading icon (the group's `--control-px` and `--control-gap`) so
            a search field sits in a toolbar row with the same insets as the pills next to it. */}
        <InputGroupAddon className="pr-(--control-gap) pl-[calc(var(--control-px)-2px)]">
          <IconMagnifyingGlass />
        </InputGroupAddon>
        <InputGroupInput
          ref={mergeRefs(inputRef, ref)}
          value={value}
          onChange={event => onValueChange(event.target.value)}
          {...inputProps}
          type="search"
        />
        {(onClose || value) && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton aria-label={onClose ? 'Close search' : 'Clear search'} onClick={onClose ? close : clear}>
              <IconCrossMedium />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </Field>
  );
}
