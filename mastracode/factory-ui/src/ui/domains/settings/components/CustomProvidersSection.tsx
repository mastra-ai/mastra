import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  SettingsEmptyRow,
  SettingsItem,
  SettingsItemIcon,
  SettingsListHeader,
  SettingsNoticeRow,
} from '@mastra/playground-ui/new/settings';
import { Plus, Server } from 'lucide-react';
import { useState } from 'react';

import type { CustomProviderInfo } from '../../../../api/types';
import { useCustomProvidersQuery, useRemoveCustomProvider } from '../../../../hooks/use-custom-providers';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { CustomProviderForm } from './CustomProviderForm';

/**
 * Organization-scoped OpenAI-compatible endpoint definitions. Keys are
 * write-only; the server reports only their presence. Renders the rows of
 * its section's `SettingsContainer`.
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

  const addProvider = draft ? undefined : (
    <Button size="sm" icon={<Plus />} onClick={() => setDraft('new')} disabled={busy}>
      Add provider
    </Button>
  );

  return (
    <>
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
      ) : providers.length === 0 ? (
        <SettingsEmptyRow action={addProvider}>No custom providers</SettingsEmptyRow>
      ) : (
        <SettingsListHeader action={addProvider}>
          {providers.length === 1 ? '1 provider' : `${providers.length} providers`}
        </SettingsListHeader>
      )}

      {(error ?? queryError) && (
        <SettingsNoticeRow>
          <Txt as="p" variant="caption" className="text-destructive-foreground">
            {error ?? queryError}
          </Txt>
        </SettingsNoticeRow>
      )}

      {draft && (
        <CustomProviderForm
          key={draft === 'new' ? 'new' : draft.id}
          provider={draft === 'new' ? undefined : draft}
          onCancel={() => setDraft(null)}
          onSaved={() => setDraft(null)}
        />
      )}

      {!loading &&
        providers.map(provider => (
          <SettingsItem
            key={provider.id}
            media={
              <SettingsItemIcon>
                <Server />
              </SettingsItemIcon>
            }
            title={provider.name}
            description={
              <Metadata singleLine>
                <Metadata.Item>{provider.url}</Metadata.Item>
                {provider.models.length > 0 && (
                  <Metadata.Item className="shrink-0">
                    {provider.models.length} model{provider.models.length === 1 ? '' : 's'}
                  </Metadata.Item>
                )}
              </Metadata>
            }
          >
            {provider.hasApiKey && (
              <Badge size="sm" variant="success">
                Key saved
              </Badge>
            )}
            <Button size="sm" disabled={busy} onClick={() => setDraft(provider)}>
              Edit
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void remove(provider.id)}>
              Remove
            </Button>
          </SettingsItem>
        ))}
    </>
  );
}
