import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { AvailableModelOption } from '../../../../../shared/hooks/useAvailableModels';
import {
  useFactoryProjectQuery,
  useSetFactoryDefaultModelMutation,
} from '../../../../../shared/hooks/useFactoryDefaultModel';
import { useParams } from 'react-router';

import { ModelCombobox } from './ModelCombobox';

/**
 * Factory default model. Persisted on the Factory project itself; factory
 * runs (issue triage, board work items) and new chats start on it. The
 * setting is mandatory — it can be changed but not cleared.
 */
export function FactoryDefaultModelSection({ models }: { models: AvailableModelOption[] }) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const projectQuery = useFactoryProjectQuery(factoryId);
  const setDefaultModel = useSetFactoryDefaultModelMutation(factoryId);

  if (!factoryId) return null;

  const defaultModelId = projectQuery.data?.defaultModelId ?? '';
  const error = setDefaultModel.error ?? projectQuery.error;

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex flex-col gap-0.5">
        <Txt as="span" variant="ui-md" className="text-icon5">
          Factory default model
        </Txt>
        <Txt as="span" variant="ui-sm" className="text-icon3">
          Factory runs (triage, board work items) start on this model
        </Txt>
        {error && (
          <Txt as="span" variant="ui-xs" className="text-notice-destructive-fg">
            {error instanceof Error ? error.message : String(error)}
          </Txt>
        )}
      </div>
      <div className="flex w-full max-w-72 items-center gap-2">
        {setDefaultModel.isPending && (
          <Spinner size="sm" aria-label="Saving default model" className="text-icon3 shrink-0" />
        )}
        <label className="min-w-0 flex-1">
          <span className="sr-only">Factory default model</span>
          <ModelCombobox
            models={models}
            value={defaultModelId}
            placeholder="Select a model"
            disabled={projectQuery.isPending || setDefaultModel.isPending}
            onValueChange={value => setDefaultModel.mutate(value)}
          />
        </label>
      </div>
    </div>
  );
}
