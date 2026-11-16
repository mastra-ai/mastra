import type { ReactNode } from 'react';
import type { ModelPickerProvider } from './model-picker-types';
import { Button } from '@/ds/components/Button';
import { cn } from '@/utils/cn';

interface ModelPickerProviderFilterProps {
  providers: ModelPickerProvider[];
  value?: string;
  onChange: (providerId: string | undefined) => void;
  /** Providers kept out of the row; a trailing button lists them. */
  moreCount: number;
  browsingMore: boolean;
  onBrowseMore: () => void;
  renderProviderIcon: (providerId: string) => ReactNode;
  sheet: boolean;
}

/** "All", one toggle per provider (pressing the active one again shows all), then the rest behind one button. */
export function ModelPickerProviderFilter({
  providers,
  value,
  onChange,
  moreCount,
  browsingMore,
  onBrowseMore,
  renderProviderIcon,
  sheet,
}: ModelPickerProviderFilterProps) {
  const pillClassName = cn('shrink-0 aria-pressed:bg-fill aria-pressed:text-foreground', sheet && 'h-11 px-4');
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
        className={pillClassName}
        aria-pressed={!value && !browsingMore}
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
      {moreCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={pillClassName}
          aria-pressed={browsingMore}
          aria-label={`${moreCount} more providers`}
          onClick={onBrowseMore}
        >
          +{moreCount}
        </Button>
      ) : null}
    </div>
  );
}
