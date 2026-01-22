import { Badge } from '@/ds/components/Badge/Badge';
import { Txt } from '@/ds/components/Txt/Txt';
import { CheckIcon } from '@/ds/icons/CheckIcon';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { Loader2 } from 'lucide-react';

import type { ProviderStatus } from '../types';

// Provider logos
const PROVIDER_LOGOS: Record<string, string> = {
  arcade: 'https://avatars.githubusercontent.com/u/153409375?s=200&v=4',
  composio: 'https://avatars.githubusercontent.com/u/128464815?s=200&v=4',
  mcp: 'https://avatars.githubusercontent.com/u/182288589?s=200&v=4',
  smithery: 'https://avatars.githubusercontent.com/u/190488992?s=200&v=4',
};

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
    <div className={cn('grid grid-cols-3 gap-3', className)}>
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
  const isMCP = provider.provider === 'mcp';
  const isSmithery = provider.provider === 'smithery';
  // MCP and Smithery are always clickable (dynamic connection), others need to be connected
  const isClickable = (isMCP || isSmithery || provider.connected) && onSelect;

  const handleClick = () => {
    if (isClickable) {
      onSelect(provider.provider);
    }
  };

  // Get badge for provider
  const getBadge = () => {
    if (isMCP) {
      return <Badge variant="default">Enter URL</Badge>;
    }
    if (isSmithery) {
      return <Badge variant="default">Browse</Badge>;
    }
    if (provider.connected) {
      return (
        <Badge variant="success" icon={<CheckIcon />}>
          Connected
        </Badge>
      );
    }
    return <Badge variant="default">Not Connected</Badge>;
  };

  const logoUrl = PROVIDER_LOGOS[provider.provider.toLowerCase()];

  const card = (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors min-h-[140px]',
        'border-border1 bg-surface3',
        isClickable && 'cursor-pointer hover:border-border2 hover:bg-surface4',
        isSelected && 'border-accent1 bg-surface4',
        !isClickable && 'opacity-60 cursor-not-allowed',
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
      {/* Provider Logo */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface2 flex items-center justify-center">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${provider.name} logo`}
            className="w-full h-full object-cover"
          />
        ) : (
          <Txt variant="ui-lg" className="text-icon3">
            {provider.name.charAt(0).toUpperCase()}
          </Txt>
        )}
      </div>

      {/* Provider Name */}
      <Txt variant="ui-md" className="text-icon6 text-center font-medium">
        {provider.name}
      </Txt>

      {/* Badge */}
      {getBadge()}
    </div>
  );

  // Show tooltip for disconnected non-MCP/Smithery providers
  if (!provider.connected && !isMCP && !isSmithery) {
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
