import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { ProviderInfo } from '../../../../api/types';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { ModelCombobox } from '../../settings/components/ModelCombobox';
import { SharedCredentialNotice } from '../../settings/components/SharedCredentialNotice';
import { providerDisplayName } from '../../settings/components/provider-display-name';
import { useState } from 'react';
import { useProviderModels } from '../hooks/useProviderModels';
import { ProviderBrandIcon } from './ProviderBrandIcon';

export interface FactoryDefaultModelFormProps {
  scope?: 'org' | 'user';
  initialModelId?: string;
  provider: ProviderInfo;
  onContinue: (modelId: string) => void;
  onChangeProvider: () => void;
  onPreviewModel?: (model: string) => void;
  submitLabel?: string;
}

/** Choose the draft default; the wizard persists it only on final confirmation. */
export function FactoryDefaultModelForm({
  scope = 'org',
  initialModelId,
  provider,
  onContinue,
  onChangeProvider,
  onPreviewModel,
  submitLabel = 'Continue',
}: FactoryDefaultModelFormProps) {
  const choice = useProviderModels(provider.provider);
  const [selectedModelId, setModelId] = useState(initialModelId);
  const modelId = choice.models.find(model => model.id === selectedModelId)?.id ?? choice.suggestedModelId ?? '';

  if (choice.isPending) return <SkeletonRows label="Loading models" rows={2} rowClassName="h-9 w-full" />;
  if (choice.catalogError || choice.models.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Txt as="p" variant="caption" role="alert">
          {choice.catalogError?.message ?? 'No models are available for this connection yet.'}
        </Txt>
        <div className="flex gap-2">
          <Button onClick={choice.retry}>Retry</Button>
          <Button onClick={onChangeProvider}>Change provider</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ProviderBrandIcon provider={provider.provider} />
          <Txt tone="ink" as="span" variant="body">
            {providerDisplayName(provider.provider)}
          </Txt>
        </div>
        <Button onClick={onChangeProvider}>Change provider</Button>
      </div>
      <Field>
        <FieldLabel>{scope === 'user' ? 'Your default model' : 'Factory default model'}</FieldLabel>
        <ModelCombobox
          models={choice.models}
          value={modelId}
          onValueChange={modelId => {
            setModelId(modelId);
            onPreviewModel?.(modelId);
          }}
          placeholder="Select a default model…"
        />
      </Field>
      {scope === 'org' && <SharedCredentialNotice modelId={modelId || undefined} />}
      <Button
        variant="primary"
        className="w-full"
        disabled={!modelId}
        onClick={() => {
          onPreviewModel?.(modelId);
          onContinue(modelId);
        }}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
