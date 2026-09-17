import { ChevronDown } from 'lucide-react';
import { createContext, useContext, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { buttonVariants } from '@/ds/components/Button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/ds/components/Command';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { cn } from '@/lib/utils';

interface ModelPickerContextValue {
  busy: boolean;
  close: () => void;
}

const ModelPickerContext = createContext<ModelPickerContextValue | undefined>(undefined);

function useModelPicker() {
  const context = useContext(ModelPickerContext);
  if (!context) throw new Error('Model picker parts must be inside ModelPicker');
  return context;
}

export function ModelPicker({ children, busy = false }: { children: ReactNode; busy?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <ModelPickerContext.Provider value={{ busy, close: () => setOpen(false) }}>
      <Popover open={open} onOpenChange={setOpen}>
        {children}
      </Popover>
    </ModelPickerContext.Provider>
  );
}

export function ModelPickerTrigger({
  label,
  title,
  notConfigured = false,
}: {
  label: string;
  title?: string;
  notConfigured?: boolean;
}) {
  const { busy } = useModelPicker();
  return (
    <PopoverTrigger
      type="button"
      disabled={busy}
      aria-label={notConfigured ? `Session model, ${label} is not configured` : 'Session model'}
      aria-busy={busy}
      className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), notConfigured ? 'text-accent2' : 'text-neutral3')}
      title={title}
    >
      <span className="max-w-48 truncate">
        {label}
        {notConfigured ? ' · not configured' : null}
      </span>
      <ChevronDown aria-hidden size={12} />
    </PopoverTrigger>
  );
}

export function ModelPickerContent({
  children,
  searchPlaceholder = 'Search models…',
  footer,
}: {
  children: ReactNode;
  searchPlaceholder?: string;
  footer?: ReactNode;
}) {
  return (
    <PopoverContent align="start" className="w-80 p-0">
      <Command loop>
        <CommandInput placeholder={searchPlaceholder} />
        <CommandList className="max-h-80">
          <CommandEmpty>No matching model.</CommandEmpty>
          {children}
        </CommandList>
        {footer && <p className="border-border1 text-ui-xs text-neutral3 border-t px-3 py-2">{footer}</p>}
      </Command>
    </PopoverContent>
  );
}

export function ModelPickerItem({ onSelect, disabled, ...props }: ComponentProps<typeof CommandItem>) {
  const { busy, close } = useModelPicker();
  return (
    <CommandItem
      {...props}
      disabled={disabled || busy}
      onSelect={(value: string) => {
        if (disabled || busy) return;
        close();
        onSelect?.(value);
      }}
    />
  );
}
