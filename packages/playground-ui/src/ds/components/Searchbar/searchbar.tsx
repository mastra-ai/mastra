import { SearchIcon } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';

export type SearchbarProps = {
  onSearch: (search: string) => void;
  label: string;
  placeholder: string;
  debounceMs?: number;
};

export const Searchbar = ({ onSearch, label, placeholder, debounceMs = 300 }: SearchbarProps) => {
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
    <div className="focus-within:outline focus-within:outline-accent1 -outline-offset-2 border border-icon-3 flex h-8 w-full items-center gap-2 overflow-hidden rounded-lg pl-2 pr-1">
      <SearchIcon className="text-neutral3 h-4 w-4" />

      <div className="flex-1">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>

        <input
          id={id}
          type="text"
          placeholder={placeholder}
          className="bg-surface2 text-ui-md placeholder:text-icon-3 block h-8 w-full px-2 outline-none"
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
