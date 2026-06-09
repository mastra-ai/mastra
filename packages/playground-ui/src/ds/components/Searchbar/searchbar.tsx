import { SearchIcon } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { controlHeight, controlSizeClasses } from '@/ds/primitives/control-size';
import type { ControlSize } from '@/ds/primitives/control-size';
import { inputFocusBorderWithin, inputHoverBorderWithin } from '@/ds/primitives/form-element';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

type SearchbarVariant = 'default' | 'filled' | 'outline';

export type SearchbarProps = {
  onSearch: (search: string) => void;
  label: string;
  placeholder: string;
  debounceMs?: number;
  size?: ControlSize;
  variant?: SearchbarVariant;
  className?: string;
};

// `default` and `filled` are the same filled surface on purpose: the default Searchbar
// look IS the filled treatment, and `filled` is an explicit alias for consumers. Share
// the class string so the two can't drift.
const searchbarFilledSurface = cn(
  'bg-surface-overlay-soft rounded-full',
  'hover:bg-surface-overlay-strong',
  inputHoverBorderWithin,
  'outline-hidden focus-within:outline-hidden focus-within:bg-surface-overlay-strong',
  inputFocusBorderWithin,
);

const searchbarVariantClasses: Record<SearchbarVariant, string> = {
  default: searchbarFilledSurface,
  filled: searchbarFilledSurface,
  outline: cn(
    'bg-transparent rounded-full',
    inputHoverBorderWithin,
    'outline-hidden focus-within:outline-hidden',
    inputFocusBorderWithin,
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
        controlHeight[size],
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
            'bg-transparent placeholder:text-neutral2 block w-full px-2 outline-hidden',
            controlSizeClasses[size],
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
