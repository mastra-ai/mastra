import { SearchIcon } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import { Kbd } from './kbd';

export interface SearchbarProps {
  onSearch: (search: string) => void;
  label: string;
  placeholder: string;
}

export const Searchbar = ({ onSearch, label, placeholder }: SearchbarProps) => {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const search = formData.get(id) as string;
    onSearch(search);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-sm border-icon-3 flex h-8 w-full items-center gap-2 overflow-hidden rounded-lg pl-2 pr-1"
    >
      <SearchIcon className="text-icon3 h-4 w-4" />

      <div className="flex-1">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>

        <input
          id={id}
          type="text"
          placeholder={placeholder}
          className="bg-surface2 text-ui-md placeholder:text-icon-3 block h-8 w-full px-2 -outline-offset-2"
          name={id}
          ref={inputRef}
        />
      </div>

      <button type="submit" className="text-ui-sm text-icon3 flex flex-row items-center gap-1">
        <Kbd>Enter</Kbd>
      </button>
    </form>
  );
};
