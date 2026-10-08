import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Search, X } from 'lucide-react';
import { useRef } from 'react';

/** The search control fills its row; only text is inset to accommodate its icons. */
export function SidebarSearchInput({
  label,
  placeholder,
  value,
  onValueChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="relative h-10 shrink-0 border-b border-surface-rim">
      <Input
        ref={input}
        type="search"
        variant="unstyled"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={event => onValueChange(event.target.value)}
        className="h-full w-full rounded-none bg-transparent pr-10 pl-10 focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-border-focus"
      />
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Clear ${label.toLowerCase()}`}
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => {
            onValueChange('');
            input.current?.focus();
          }}
        >
          <X />
        </Button>
      )}
    </div>
  );
}
