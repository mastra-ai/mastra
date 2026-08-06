import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { useFactoryProjectQuery, useSetFactoryDefaultModelMutation } from '../../../../hooks/useFactoryDefaultModel';
import { useParams } from 'react-router';

import { ModelCombobox } from './ModelCombobox';
import { SettingsRow } from './SettingsCard';
import { SharedCredentialNotice } from './SharedCredentialNotice';

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
    <SettingsRow
      label="Factory default model"
      hint={
        <>
          <span>Factory runs (triage, board work items) start on this model</span>
          {error && (
            <Txt as="span" variant="ui-xs" className="text-notice-destructive-fg">
              {error instanceof Error ? error.message : String(error)}
            </Txt>
          )}
          <SharedCredentialNotice modelId={defaultModelId || undefined} />
        </>
      }
    >
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
    </SettingsRow>
  );
}
