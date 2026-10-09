import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { useClearDefaultModel, useDefaultModelQuery, useSetDefaultModel } from '../../../../hooks/use-default-model';
import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { ModelCombobox } from './ModelCombobox';

export function DefaultModelSection({ models }: { models: AvailableModelOption[] }) {
  const defaultModelQuery = useDefaultModelQuery();

  if (defaultModelQuery.isPending) {
    return <SkeletonRows label="Loading default model" rows={1} rowClassName="h-9 w-full" />;
  }

  if (defaultModelQuery.error) {
    return (
      <Txt as="p" variant="caption" className="text-destructive-foreground">
        {defaultModelQuery.error.message}
      </Txt>
    );
  }

  return (
    <DefaultModelEditor
      key={defaultModelQuery.data.modelId ?? 'no-default'}
      models={models}
      defaultModelId={defaultModelQuery.data.modelId ?? undefined}
    />
  );
}

function DefaultModelEditor({
  models,
  defaultModelId,
}: {
  models: AvailableModelOption[];
  defaultModelId: string | undefined;
}) {
  const setDefaultModel = useSetDefaultModel();
  const clearDefaultModel = useClearDefaultModel();
  const [modelId, setModelId] = useState(defaultModelId ?? '');
  const [error, setError] = useState<string>();
  const busy = setDefaultModel.isPending || clearDefaultModel.isPending;

  const save = async () => {
    if (!modelId) return;
    setError(undefined);
    try {
      await setDefaultModel.mutateAsync(modelId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const clear = async () => {
    setError(undefined);
    try {
      await clearDefaultModel.mutateAsync();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Field className="gap-1">
        <FieldLabel>Default model</FieldLabel>
        <ModelCombobox models={models} value={modelId} onValueChange={setModelId} disabled={busy} />
      </Field>
      {error ? (
        <Txt as="p" variant="caption" className="text-destructive-foreground">
          {error}
        </Txt>
      ) : null}
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={busy || !modelId || modelId === defaultModelId}
          onClick={() => void save()}
        >
          Save
        </Button>
        <Button size="sm" disabled={busy || !defaultModelId} onClick={() => void clear()}>
          Clear
        </Button>
      </div>
    </div>
  );
}
