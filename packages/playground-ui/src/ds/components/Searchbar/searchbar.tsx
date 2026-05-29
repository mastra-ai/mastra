import { SearchIcon } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { formElementSizes } from '@/ds/primitives/form-element';
import type { FormElementSize } from '@/ds/primitives/form-element';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

type SearchbarVariant = 'default' | 'filled' | 'outline';

export type SearchbarProps = {
  onSearch: (search: string) => void;
  label: string;
  placeholder: string;
  debounceMs?: number;
  size?: FormElementSize;
  variant?: SearchbarVariant;
  className?: string;
};

const searchbarSizeClasses = {
  sm: formElementSizes.sm,
  md: formElementSizes.md,
  lg: formElementSizes.lg,
  default: formElementSizes.default,
};

const searchbarVariantClasses: Record<SearchbarVariant, string> = {
  default: cn(
    'bg-surface-overlay-soft rounded-full',
    'hover:bg-surface-overlay-strong hover:border-border2',
    'outline-hidden focus-within:outline-hidden focus-within:bg-surface-overlay-strong focus-within:border-border2',
  ),
  filled: cn(
    'bg-surface-overlay-soft rounded-full',
    'hover:bg-surface-overlay-strong hover:border-border2',
    'outline-hidden focus-within:outline-hidden focus-within:bg-surface-overlay-strong focus-within:border-border2',
  ),
  outline: cn(
    'bg-transparent rounded-full',
    'hover:border-border2',
    'outline-hidden focus-within:outline-hidden focus-within:border-border2',
  ),
};

export const Searchbar = ({
  onSearch,
  label,
  placeholder,
  debounceMs = 300,
  size = 'md',
  variant = 'outline',
  className,
}: SearchbarProps) => {
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
        transitions.all,
        searchbarVariantClasses[variant],
        searchbarSizeClasses[size],
        className,
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
            'bg-transparent text-ui-md placeholder:text-neutral3 block w-full px-2 outline-hidden',
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
