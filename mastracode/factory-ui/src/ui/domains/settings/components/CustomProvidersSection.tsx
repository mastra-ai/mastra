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
  SettingsSkeleton,
} from '@mastra/playground-ui/new/settings';
import { Plus, Server } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import type { CustomProviderInfo } from '../../../../api/types';
import { useCustomProvidersQuery, useRemoveCustomProvider } from '../../../../hooks/use-custom-providers';
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
      <CustomProvidersListTop
        loading={loading}
        failed={queryError !== null}
        count={providers.length}
        addProvider={addProvider}
      />

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

/** The list's first row: a skeleton while loading, nothing if it failed, else the count or the empty row. */
function CustomProvidersListTop({
  loading,
  failed,
  count,
  addProvider,
}: {
  loading: boolean;
  failed: boolean;
  count: number;
  addProvider: ReactNode;
}) {
  if (loading) return <SettingsSkeleton label="Loading custom providers" variant="item" rows={2} />;
  if (failed) return null;
  if (count === 0) return <SettingsEmptyRow action={addProvider}>No custom providers</SettingsEmptyRow>;
  return (
    <SettingsListHeader action={addProvider}>{count === 1 ? '1 provider' : `${count} providers`}</SettingsListHeader>
  );
}
