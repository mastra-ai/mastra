import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { ProviderInfo } from '../../../../api/types';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { ModelCombobox } from '../../settings/components/ModelCombobox';
import { SharedCredentialNotice } from '../../settings/components/SharedCredentialNotice';
import { providerDisplayName } from '../../settings/components/provider-display-name';
import { useFactoryModelChoice } from '../hooks/useFactoryModelChoice';
import { ProviderBrandIcon } from './ProviderBrandIcon';

export interface FactoryDefaultModelFormProps {
  factoryId: string;
  provider: ProviderInfo;
  onSaved: () => void;
  onChangeProvider: () => void;
}

/** The model a connected provider runs on, saved as the Factory default. */
export function FactoryDefaultModelForm({
  factoryId,
  provider,
  onSaved,
  onChangeProvider,
}: FactoryDefaultModelFormProps) {
  const choice = useFactoryModelChoice({ factoryId, providerId: provider.provider, onSaved });

  if (choice.isPending) return <SkeletonRows label="Loading models" rows={2} rowClassName="h-9 w-full" />;
  if (choice.catalogError) {
    return (
      <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg m-0" role="alert">
        {choice.catalogError.message}
      </Txt>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ProviderBrandIcon provider={provider.provider} />
          <Txt as="span" variant="ui-md" className="text-icon6">
            {providerDisplayName(provider.provider)}
          </Txt>
        </div>
        <Button variant="outline" disabled={choice.saving} onClick={onChangeProvider}>
          Change provider
        </Button>
      </div>
      <label className="flex flex-col gap-2">
        <Txt as="span" variant="ui-sm" className="text-icon5">
          Factory default model
        </Txt>
        <ModelCombobox
          models={choice.models}
          value={choice.modelId}
          onValueChange={choice.setModelId}
          placeholder="Select a default model…"
          disabled={choice.saving}
        />
      </label>
      <SharedCredentialNotice modelId={choice.modelId || undefined} />
      {choice.error && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg m-0" role="alert">
          {choice.error}
        </Txt>
      )}
      <Button
        variant="primary"
        className="w-full"
        disabled={!choice.modelId || choice.saving}
        onClick={() => void choice.save()}
      >
        {choice.saving && <Spinner size="sm" aria-label="Saving model defaults" />}
        Finish setup
      </Button>
    </div>
  );
}
