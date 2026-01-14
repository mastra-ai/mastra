import { Badge } from '@/ds/components/Badge/Badge';
import { Txt } from '@/ds/components/Txt/Txt';
import { CheckIcon } from '@/ds/icons/CheckIcon';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';

import type { ProviderStatus } from '../types';

export interface ProviderListProps {
  providers?: ProviderStatus[];
  isLoading?: boolean;
  selectedProvider?: string;
  onSelectProvider?: (provider: string) => void;
  className?: string;
}

/**
 * Displays a list of integration providers with their connection status.
 * Connected providers are clickable, disconnected providers show a tooltip explaining missing ENV var.
 */
export function ProviderList({
  providers = [],
  isLoading = false,
  selectedProvider,
  onSelectProvider,
  className,
}: ProviderListProps) {
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-icon3" />
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Txt variant="ui-md" className="text-icon3">
          No providers available
        </Txt>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {providers.map((provider) => (
        <ProviderCard
          key={provider.provider}
          provider={provider}
          isSelected={selectedProvider === provider.provider}
          onSelect={onSelectProvider}
        />
      ))}
    </div>
  );
}

interface ProviderCardProps {
  provider: ProviderStatus;
  isSelected: boolean;
  onSelect?: (provider: string) => void;
}

function ProviderCard({ provider, isSelected, onSelect }: ProviderCardProps) {
  const isClickable = provider.connected && onSelect;

  const handleClick = () => {
    if (isClickable) {
      onSelect(provider.provider);
    }
  };

  const card = (
    <div
      className={cn(
        'flex items-start gap-4 rounded-lg border p-4 transition-colors',
        'border-border1 bg-surface3',
        isClickable && 'cursor-pointer hover:border-border2 hover:bg-surface4',
        isSelected && 'border-accent1 bg-surface4',
        !provider.connected && 'opacity-60 cursor-not-allowed',
      )}
      onClick={handleClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
    >
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Txt variant="ui-lg" className="text-icon6">
            {provider.name}
          </Txt>
          {provider.connected ? (
            <Badge variant="success" icon={<CheckIcon />}>
              Connected
            </Badge>
          ) : (
            <Badge variant="default">Not Connected</Badge>
          )}
        </div>

        <Txt variant="ui-sm" className="text-icon3">
          {provider.description}
        </Txt>
      </div>
    </div>
  );

  if (!provider.connected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{card}</TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">
              Missing API key. Set <code className="font-mono">{provider.provider.toUpperCase()}_API_KEY</code>{' '}
              environment variable to connect this provider.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return card;
}
