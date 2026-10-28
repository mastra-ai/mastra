import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { ProviderInfo } from '../../../../api/types';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { ModelCombobox } from '../../settings/components/ModelCombobox';
import { SharedCredentialNotice } from '../../settings/components/SharedCredentialNotice';
import { providerDisplayName } from '@mastra/factory/provider-display-name';
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

export function FactoryDefaultModelForm({
  scope = 'org',
  initialModelId,
  provider,
  onContinue,
  onChangeProvider,
  onPreviewModel,
  submitLabel = 'Continue',
}: FactoryDefaultModelFormProps) {
  const choice = useProviderModels(provider.provider, scope);
  const [selectedModelId, setModelId] = useState(initialModelId);
  const modelId = selectedModelId
    ? (choice.models.find(model => model.id === selectedModelId)?.id ?? '')
    : (choice.suggestedModelId ?? '');

  if (choice.isPending) {
    return (
      <div role="status" aria-label="Loading models">
        <div aria-hidden className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <SkeletonText line="text-body" className="w-32 motion-reduce:before:animate-none" />
            <Skeleton className="h-control-md w-28 rounded-full motion-reduce:before:animate-none" />
          </div>
          <Field>
            <FieldLabel>{scope === 'user' ? 'Your default model' : 'Factory default model'}</FieldLabel>
            <Skeleton className="h-control-md w-full rounded-full motion-reduce:before:animate-none" />
          </Field>
          <SkeletonText line="text-meta" className="w-3/4 motion-reduce:before:animate-none" />
          <Skeleton className="h-control-md w-full rounded-full motion-reduce:before:animate-none" />
        </div>
      </div>
    );
  }
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
      {selectedModelId && !modelId && (
        <Txt variant="caption" role="alert">
          Your previous model is no longer available. Choose another model.
        </Txt>
      )}
      {scope === 'user' && (
        <Txt variant="meta" tone="muted">
          Creating this Factory also updates your personal default model.
        </Txt>
      )}
      {scope === 'org' && <SharedCredentialNotice modelId={modelId || undefined} />}
      <Button variant="primary" className="w-full" disabled={!modelId} onClick={() => onContinue(modelId)}>
        {submitLabel}
      </Button>
    </div>
  );
}
