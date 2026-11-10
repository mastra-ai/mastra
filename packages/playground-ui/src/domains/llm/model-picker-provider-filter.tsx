import type { ReactNode } from 'react';
import type { ModelPickerProvider } from './model-picker-types';
import { Button } from '@/ds/components/Button';
import { cn } from '@/utils/cn';

interface ModelPickerProviderFilterProps {
  providers: ModelPickerProvider[];
  value?: string;
  onChange: (providerId: string | undefined) => void;
  renderProviderIcon: (providerId: string) => ReactNode;
  sheet: boolean;
}

/** "All" plus one toggle per provider; pressing the active provider again shows all of them. */
export function ModelPickerProviderFilter({
  providers,
  value,
  onChange,
  renderProviderIcon,
  sheet,
}: ModelPickerProviderFilterProps) {
  return (
    <div
      role="group"
      aria-label="Filter by provider"
      className="flex [scrollbar-width:thin] items-center gap-1 overflow-x-auto px-2 py-1.5"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn('shrink-0 aria-pressed:bg-fill aria-pressed:text-foreground', sheet && 'h-11 px-4')}
        aria-pressed={!value}
        onClick={() => onChange(undefined)}
      >
        All
      </Button>
      {providers.map(provider => {
        const disconnected = provider.connected === false;
        return (
          <Button
            key={provider.id}
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn('relative shrink-0 aria-pressed:bg-fill', sheet && 'size-11')}
            aria-pressed={value === provider.id}
            aria-label={disconnected ? `${provider.name}, not connected` : provider.name}
            tooltip={disconnected ? `${provider.name} (not connected)` : provider.name}
            onClick={() => onChange(value === provider.id ? undefined : provider.id)}
          >
            {renderProviderIcon(provider.id)}
            {disconnected ? (
              <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-destructive-indicator" />
            ) : null}
          </Button>
        );
      })}
    </div>
  );
}
