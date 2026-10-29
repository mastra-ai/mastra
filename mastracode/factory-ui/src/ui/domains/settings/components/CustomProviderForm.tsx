import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import type { CustomProviderInfo, SaveCustomProviderBody } from '../../../../api/types';
import { useSaveCustomProvider } from '../../../../hooks/use-custom-providers';

interface DraftState {
  name: string;
  url: string;
  apiKey: string;
  models: string;
}

export interface CustomProviderFormProps {
  provider?: CustomProviderInfo;
  requireModels?: boolean;
  onCancel?: () => void;
  onSaved?: (provider: CustomProviderInfo) => void;
}

export function CustomProviderForm({ provider, requireModels = false, onCancel, onSaved }: CustomProviderFormProps) {
  const saveMutation = useSaveCustomProvider();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>({
    name: provider?.name ?? '',
    url: provider?.url ?? '',
    apiKey: '',
    models: provider?.models.join(', ') ?? '',
  });

  const save = async () => {
    const name = draft.name.trim();
    const url = draft.url.trim();
    if (!name || !url) {
      setError('Name and URL are required.');
      return;
    }

    const models = draft.models
      .split(',')
      .map(model => model.trim())
      .filter(Boolean);
    if (requireModels && models.length === 0) {
      setError('At least one model is required.');
      return;
    }

    const apiKey = draft.apiKey.trim();
    const body: SaveCustomProviderBody = {
      name,
      url,
      models,
      ...(apiKey ? { apiKey } : {}),
      ...(provider ? { previousId: provider.id } : {}),
    };

    setError(null);
    try {
      const result = await saveMutation.mutateAsync(body);
      onSaved?.(result.provider);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <div className="border-border flex flex-col gap-3 rounded-lg border p-3">
      {error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground">
          {error}
        </Txt>
      )}
      <Field className="gap-1">
        <FieldLabel>Name</FieldLabel>
        <Input
          size="sm"
          placeholder="e.g. my-llm"
          value={draft.name}
          onChange={event => setDraft({ ...draft, name: event.target.value })}
          autoFocus
        />
      </Field>
      <Field className="gap-1">
        <FieldLabel>Base URL</FieldLabel>
        <Input
          size="sm"
          placeholder="https://api.example.com/v1"
          value={draft.url}
          onChange={event => setDraft({ ...draft, url: event.target.value })}
        />
      </Field>
      <Field className="gap-1">
        <FieldLabel>API key {provider ? '(leave blank to keep)' : '(optional)'}</FieldLabel>
        <Input
          type="password"
          size="sm"
          placeholder="Paste API key"
          value={draft.apiKey}
          onChange={event => setDraft({ ...draft, apiKey: event.target.value })}
        />
      </Field>
      <Field className="gap-1">
        <FieldLabel>Models (comma-separated)</FieldLabel>
        <Input
          size="sm"
          placeholder="model-a, model-b"
          value={draft.models}
          onChange={event => setDraft({ ...draft, models: event.target.value })}
        />
      </Field>
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" disabled={saveMutation.isPending} onClick={() => void save()}>
          {saveMutation.isPending && <Spinner size="sm" aria-hidden className="size-3" />}
          {provider ? 'Save' : 'Add'}
        </Button>
        {onCancel && (
          <Button size="sm" disabled={saveMutation.isPending} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
