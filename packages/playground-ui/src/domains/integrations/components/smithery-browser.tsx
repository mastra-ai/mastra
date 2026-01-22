'use client';

import { useState } from 'react';
import { Loader2, Search, CheckCircle2, ExternalLink, Shield, Star } from 'lucide-react';
import { useMastraClient } from '@mastra/react';

import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Txt } from '@/ds/components/Txt';
import { Badge } from '@/ds/components/Badge';
import { cn } from '@/lib/utils';
import { useSmitheryServers } from '../hooks/use-smithery';
import type { SmitheryServer, SmitheryServerConnection } from '@mastra/client-js';

/**
 * Props for the SmitheryBrowser component.
 */
export interface SmitheryBrowserProps {
  /** Currently selected server qualified name */
  selectedServer?: string;
  /** Callback when a server is selected */
  onServerSelect?: (server: SmitheryServer, connection?: SmitheryServerConnection) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Component for browsing and selecting MCP servers from the Smithery Registry.
 */
export function SmitheryBrowser({ selectedServer, onServerSelect, className }: SmitheryBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const client = useMastraClient();

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useSmitheryServers({
    q: searchQuery || undefined,
    pageSize: 12,
  });

  // Flatten all pages of servers
  const servers = data?.pages.flatMap(page => page.servers) ?? [];
  const totalCount = data?.pages[0]?.pagination?.totalCount ?? 0;

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  // Fetch server details on click
  const handleServerClick = async (server: SmitheryServer) => {
    if (!onServerSelect) return;

    try {
      // Fetch full server details including connection info
      const serverDetails = await client.getSmitheryServer(server.qualifiedName);
      onServerSelect(server, serverDetails.connection);
    } catch {
      // If fetching details fails, still select the server but without connection
      onServerSelect(server, undefined);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-icon3" />
          <Input
            type="search"
            placeholder="Search MCP servers (e.g., filesystem, github, slack)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Results info */}
      {totalCount > 0 && !isLoading && (
        <Txt variant="ui-sm" className="text-icon3">
          {totalCount} server{totalCount === 1 ? '' : 's'} found
        </Txt>
      )}

      {/* Server grid */}
      {isLoading && servers.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-icon3" />
        </div>
      ) : error ? (
        <div className="bg-destructive1/10 border border-destructive1/30 rounded-lg p-4">
          <Txt variant="ui-sm" className="text-destructive1">
            Failed to load Smithery servers. Please try again.
          </Txt>
        </div>
      ) : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Txt variant="ui-md" className="text-icon3">
            No servers found
          </Txt>
          <Txt variant="ui-sm" className="text-icon2 mt-1">
            Try a different search term
          </Txt>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {servers.map(server => (
            <SmitheryServerCard
              key={server.qualifiedName}
              server={server}
              isSelected={selectedServer === server.qualifiedName}
              onSelect={handleServerClick}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="md" onClick={handleLoadMore} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Props for a single server card.
 */
interface SmitheryServerCardProps {
  server: SmitheryServer;
  isSelected: boolean;
  onSelect?: (server: SmitheryServer) => void;
}

/**
 * Card component for a single Smithery server.
 */
function SmitheryServerCard({ server, isSelected, onSelect }: SmitheryServerCardProps) {
  const handleClick = () => {
    if (onSelect) {
      onSelect(server);
    }
  };

  return (
    <div
      className={cn(
        'group relative rounded-lg border p-4 transition-all cursor-pointer',
        'border-border1 bg-surface3 hover:border-border2 hover:bg-surface4',
        isSelected && 'border-accent1 bg-surface4 ring-1 ring-accent1/20'
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >

      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        {server.iconUrl ? (
          <img
            src={server.iconUrl}
            alt=""
            className="w-8 h-8 rounded-md flex-shrink-0 object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-md bg-surface5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Txt variant="ui-md" className="font-medium text-icon6 truncate">
              {server.displayName}
            </Txt>
            {server.verified && (
              <CheckCircle2 className="w-4 h-4 text-accent1 flex-shrink-0" />
            )}
          </div>
          <Txt variant="ui-xs" className="text-icon2 truncate">
            {server.qualifiedName}
          </Txt>
        </div>
      </div>

      {/* Description */}
      {server.description && (
        <Txt variant="ui-sm" className="text-icon3 line-clamp-2 mb-3">
          {server.description}
        </Txt>
      )}

      {/* Footer badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {server.verified && (
          <Badge variant="success" className="text-xs">
            <Shield className="w-3 h-3 mr-1" />
            Verified
          </Badge>
        )}
        {server.remote && (
          <Badge variant="default" className="text-xs">
            Remote
          </Badge>
        )}
        {server.useCount !== undefined && server.useCount > 0 && (
          <Badge variant="default" className="text-xs">
            <Star className="w-3 h-3 mr-1" />
            {server.useCount.toLocaleString()}
          </Badge>
        )}
        {server.homepage && (
          <a
            href={server.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-icon3 hover:text-icon5"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <CheckCircle2 className="w-5 h-5 text-accent1" />
        </div>
      )}
    </div>
  );
}
