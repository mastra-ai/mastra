import { useRef } from 'react';
import { TreeIcon } from './tree-icon';
import { IconFileBend } from '@/ds/icons/central/IconFileBend';
import { IconFolder1 } from '@/ds/icons/central/IconFolder1';
import { passwordManagerOptOutProps } from '@/ds/primitives/password-manager-autofill';
import { cn } from '@/lib/utils';

export interface TreeInputProps {
  type: 'file' | 'folder';
  onSubmit: (name: string) => void;
  onCancel?: () => void;
  defaultValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function TreeInput({
  type,
  onSubmit,
  onCancel,
  defaultValue = '',
  placeholder,
  autoFocus = true,
  className,
}: TreeInputProps) {
  const submitted = useRef(false);
  const Icon = type === 'folder' ? IconFolder1 : IconFileBend;

  const submit = (value: string) => {
    if (submitted.current) return;
    const name = value.trim();
    if (!name) return onCancel?.();
    submitted.current = true;
    onSubmit(name);
  };

  return (
    <>
      <TreeIcon>
        <Icon className="text-muted-foreground" />
      </TreeIcon>
      <input
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            submit(event.currentTarget.value);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onCancel?.();
          }
        }}
        onBlur={event => submit(event.currentTarget.value)}
        onFocus={event => event.currentTarget.select()}
        {...passwordManagerOptOutProps}
        className={cn(
          'min-w-0 flex-1 border-none bg-transparent text-caption zoom-safe-text text-foreground outline-hidden placeholder:text-muted-foreground',
          className,
        )}
      />
    </>
  );
}
