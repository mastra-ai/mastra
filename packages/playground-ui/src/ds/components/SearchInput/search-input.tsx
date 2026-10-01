import { SearchIcon, XIcon } from 'lucide-react';
import { useRef } from 'react';
import type { Ref } from 'react';
import { Field, FieldLabel } from '@/ds/components/Field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/ds/components/InputGroup';
import type { InputGroupInputProps, InputGroupProps } from '@/ds/components/InputGroup';
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
      <InputGroup size={size}>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          ref={mergeRefs(inputRef, ref)}
          value={value}
          onChange={event => onValueChange(event.target.value)}
          {...inputProps}
          type="search"
        />
        {onClose ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton aria-label="Close search" onClick={close}>
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        ) : value ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton aria-label="Clear search" onClick={clear}>
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </Field>
  );
}
