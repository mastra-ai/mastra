import { SearchIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, useDeferredValue } from 'react';

export interface SearchbarProps {
  onSearch: (search: string) => void;
  label: string;
  placeholder: string;
}

export const Searchbar = ({ onSearch, label, placeholder }: SearchbarProps) => {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const deferredValue = useDeferredValue(value);

  // Keep callback ref stable to avoid requiring useCallback from consumers
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  // Sync deferred value to parent
  useEffect(() => {
    onSearchRef.current(deferredValue);
  }, [deferredValue]);

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
    setValue(e.target.value);
  };

  return (
    <div className="focus-within:outline focus-within:outline-accent1 -outline-offset-2 border-sm border-icon-3 flex h-8 w-full items-center gap-2 overflow-hidden rounded-lg pl-2 pr-1">
      <SearchIcon className="text-icon3 h-4 w-4" />

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
          value={value}
          onChange={handleChange}
        />
      </div>
    </div>
  );
};

export const SearchbarWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div className="px-4 py-2 border-b-sm border-border1">{children}</div>;
};
