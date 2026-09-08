import { CommandGroup } from '@mastra/playground-ui/components/Command';
import { CommandPaletteItem } from '@mastra/playground-ui/components/CommandPalette';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { RefreshCw } from 'lucide-react';

import type { ProviderInfo } from '../../../../../api/types';
import { SkeletonRows } from '../../../../ui/SkeletonRows';
import { SharedCredentialNotice } from '../../../settings/components/SharedCredentialNotice';
import { providerDisplayName } from '../../../settings/components/provider-display-name';
import { useProviderModels } from '../../hooks/useProviderModels';
import { ProviderBrandIcon } from '../ProviderBrandIcon';
import { CreateFactoryPaletteAlert, CreateFactoryPaletteMessage } from './CreateFactoryPalette';

export interface CreateFactoryModelRowsProps {
  provider: ProviderInfo;
  query: string;
  /** The model being written to the Factory being created. */
  savingModelId?: string;
  error?: string;
  onPick: (modelId: string) => void;
  onChangeProvider: () => void;
}

export function CreateFactoryModelRows({
  provider,
  query,
  savingModelId,
  error,
  onPick,
  onChangeProvider,
}: CreateFactoryModelRowsProps) {
  const catalog = useProviderModels(provider.provider);

  if (catalog.isPending) {
    return <SkeletonRows label="Loading models" rows={3} rowClassName="mx-2 my-1 h-12 rounded-xl" />;
  }
  if (catalog.catalogError)
    return <CreateFactoryPaletteAlert>{catalog.catalogError.message}</CreateFactoryPaletteAlert>;

  const normalizedQuery = query.trim().toLowerCase();
  const models = catalog.models.filter(
    model =>
      model.id.toLowerCase().includes(normalizedQuery) || model.modelName.toLowerCase().includes(normalizedQuery),
  );
  const saving = savingModelId !== undefined;

  return (
    <>
      {error && <CreateFactoryPaletteAlert>{error}</CreateFactoryPaletteAlert>}
      <div className="px-3 pt-2">
        <SharedCredentialNotice modelId={catalog.suggestedModelId} />
      </div>
      {models.length > 0 ? (
        <CommandGroup heading={`${providerDisplayName(provider.provider)} models`}>
          {models.map(model => (
            <CommandPaletteItem
              key={model.id}
              icon={
                savingModelId === model.id ? (
                  <Spinner size="sm" aria-label="Creating Factory" />
                ) : (
                  <ProviderBrandIcon provider={model.provider} />
                )
              }
              title={model.id}
              subtitle={model.modelName}
              badge={model.id === catalog.suggestedModelId ? 'Suggested' : undefined}
              shortcut={<Kbd size="sm">↵</Kbd>}
              value={model.id}
              disabled={saving}
              onSelect={() => onPick(model.id)}
            />
          ))}
        </CommandGroup>
      ) : (
        <CreateFactoryPaletteMessage>No models match this search.</CreateFactoryPaletteMessage>
      )}
      <CommandGroup heading="Provider">
        <CommandPaletteItem
          icon={<RefreshCw />}
          title="Change provider"
          subtitle={providerDisplayName(provider.provider)}
          value="change-provider"
          disabled={saving}
          onSelect={onChangeProvider}
        />
      </CommandGroup>
    </>
  );
}
