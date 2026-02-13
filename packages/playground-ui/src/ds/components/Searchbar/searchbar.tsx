import { SearchIcon } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { cn } from '@/lib/utils';
import {
  formElementSizes,
  formElementFocusWithin,
  formElementRadius,
  type FormElementSize,
} from '@/ds/primitives/form-element';
import { transitions } from '@/ds/primitives/transitions';

export type SearchbarProps = {
  onSearch: (search: string) => void;
  label: string;
  placeholder: string;
  debounceMs?: number;
  size?: FormElementSize;
};

const searchbarSizeClasses = {
  sm: formElementSizes.sm,
  md: formElementSizes.md,
  lg: formElementSizes.lg,
};

export const Searchbar = ({ onSearch, label, placeholder, debounceMs = 300, size = 'md' }: SearchbarProps) => {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebouncedCallback((value: string) => {
    onSearch(value);
  }, debounceMs);

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'f' && event.shiftKey && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        input.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  return (
    <div
      className={cn(
        'border border-border1 flex w-full items-center gap-2 overflow-hidden pl-2 pr-1',
        formElementRadius,
        formElementFocusWithin,
        transitions.all,
        'hover:border-neutral2',
        searchbarSizeClasses[size],
      )}
    >
      <SearchIcon className={cn('text-neutral3 h-4 w-4', transitions.colors)} />

      <div className="flex-1">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>

        <input
          id={id}
          type="text"
          placeholder={placeholder}
          className={cn(
            'bg-transparent text-ui-md placeholder:text-neutral3 block w-full px-2 outline-none',
            searchbarSizeClasses[size],
          )}
          name={id}
          ref={inputRef}
          onChange={handleChange}
        />
      </div>
    </div>
  );
};

export const SearchbarWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div className="px-3 py-2.5 border-b border-border1">{children}</div>;
};
