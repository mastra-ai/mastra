import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import type { CustomProviderInfo } from '../../../../api/types';
import { useCustomProvidersQuery, useRemoveCustomProvider } from '../../../../hooks/use-custom-providers';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { CustomProviderForm } from './CustomProviderForm';

/**
 * Organization-scoped OpenAI-compatible endpoint definitions. Keys are
 * write-only; the server reports only their presence.
 */
export function CustomProvidersSection() {
  const providersQuery = useCustomProvidersQuery();
  const removeMutation = useRemoveCustomProvider();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CustomProviderInfo | 'new' | null>(null);

  const providers = providersQuery.data ?? [];
  const loading = providersQuery.isPending;
  const busy = removeMutation.isPending;
  const queryError = providersQuery.error instanceof Error ? providersQuery.error.message : null;

  const remove = async (id: string) => {
    setError(null);
    try {
      await removeMutation.mutateAsync({ id });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Txt tone="muted" as="p" variant="caption">
          OpenAI-compatible endpoints.
        </Txt>
        {!draft && (
          <Button size="sm" onClick={() => setDraft('new')} disabled={busy}>
            <Plus size={13} /> Add provider
          </Button>
        )}
      </div>

      {(error ?? queryError) && (
        <Txt as="p" variant="caption" className="text-destructive-foreground">
          {error ?? queryError}
        </Txt>
      )}

      {draft && (
        <CustomProviderForm
          key={draft === 'new' ? 'new' : draft.id}
          provider={draft === 'new' ? undefined : draft}
          onCancel={() => setDraft(null)}
          onSaved={() => setDraft(null)}
        />
      )}

      {loading ? (
        <SkeletonRows label="Loading custom providers" rows={3} className="divide-border gap-0 divide-y">
          <div aria-hidden className="flex items-center justify-between gap-3 py-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <SkeletonText line="text-body" className="w-40 max-w-full motion-reduce:before:animate-none" />
              <SkeletonText line="text-meta" className="w-56 max-w-full motion-reduce:before:animate-none" />
            </div>
            <Skeleton className="size-control-sm shrink-0 rounded-full motion-reduce:before:animate-none" />
          </div>
        </SkeletonRows>
      ) : providers.length === 0 ? null : (
        <ul role="list" className="divide-border flex flex-col divide-y">
          {providers.map(provider => (
            <li key={provider.id} role="listitem" className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <Txt tone="ink" as="span" variant="body" className="truncate">
                    {provider.name}
                  </Txt>
                  {provider.hasApiKey && (
                    <Badge size="sm" variant="success">
                      Key saved
                    </Badge>
                  )}
                </div>
                <Txt tone="muted" as="span" variant="meta" className="truncate">
                  {provider.url}
                </Txt>
                {provider.models.length > 0 && (
                  <Txt tone="muted" as="span" variant="meta">
                    {provider.models.length} model{provider.models.length === 1 ? '' : 's'}
                  </Txt>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={busy} onClick={() => setDraft(provider)}>
                  Edit
                </Button>
                <Button size="sm" disabled={busy} onClick={() => void remove(provider.id)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
