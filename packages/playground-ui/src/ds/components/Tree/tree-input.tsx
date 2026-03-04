import * as React from 'react';
import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';
import { useTreeDepth } from './tree-context';
import { File, Folder } from 'lucide-react';

export interface TreeInputProps {
  type: 'file' | 'folder';
  onSubmit: (name: string) => void;
  onCancel?: () => void;
  defaultValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export const TreeInput = React.forwardRef<HTMLLIElement, TreeInputProps>(
  ({ type, onSubmit, onCancel, defaultValue = '', placeholder, autoFocus = true, className }, ref) => {
    const depth = useTreeDepth();
    const inputRef = React.useRef<HTMLInputElement>(null);
    const submittedRef = React.useRef(false);

    const handleSubmit = React.useCallback(
      (value: string) => {
        if (submittedRef.current) return;
        const trimmed = value.trim();
        if (trimmed) {
          submittedRef.current = true;
          onSubmit(trimmed);
        } else {
          onCancel?.();
        }
      },
      [onSubmit, onCancel],
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSubmit(e.currentTarget.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel?.();
        }
      },
      [handleSubmit, onCancel],
    );

    const handleBlur = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        handleSubmit(e.currentTarget.value);
      },
      [handleSubmit],
    );

    const handleFocus = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.select();
    }, []);

    const Icon = type === 'folder' ? Folder : File;

    return (
      <li
        ref={ref}
        role="treeitem"
        className={cn(
          'group flex h-7 min-w-0 items-center gap-1.5 rounded-sm px-1',
          transitions.colors,
          'focus-within:outline-none focus-within:ring-1 focus-within:ring-accent1 focus-within:shadow-focus-ring',
          className,
        )}
        style={{ paddingLeft: depth * 12 + 18 }}
      >
        <span className="flex shrink-0 items-center [&>svg]:size-3.5">
          <Icon className="text-neutral3" />
        </span>
        <input
          ref={inputRef}
          type="text"
          defaultValue={defaultValue}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          className="min-w-0 flex-1 border-none bg-transparent text-xs text-neutral5 outline-none placeholder:text-neutral3"
        />
      </li>
    );
  },
);
TreeInput.displayName = 'Tree.Input';
