import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import {
  useApplyFactoryDefaultModelMutation,
  useFactoryProjectQuery,
  useSetFactoryDefaultModelMutation,
} from '../../../../hooks/useFactoryDefaultModel';
import { useParams } from 'react-router';

import { ModelCombobox } from './ModelCombobox';
import { SettingsRow } from './SettingsCard';
import { SharedCredentialNotice } from './SharedCredentialNotice';

/**
 * Factory default model. Persisted on the Factory project itself; Factory
 * runs use it, and new chats fall back to it when the user has no default
 * model pack. The setting is mandatory and can be changed but not cleared.
 */
export function FactoryDefaultModelSection({ models }: { models: AvailableModelOption[] }) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const projectQuery = useFactoryProjectQuery(factoryId);
  const setDefaultModel = useSetFactoryDefaultModelMutation(factoryId);
  const applyToSessions = useApplyFactoryDefaultModelMutation(factoryId);

  if (!factoryId) return null;

  const defaultModelId = projectQuery.data?.defaultModelId ?? '';
  const error = setDefaultModel.error ?? applyToSessions.error ?? projectQuery.error;
  const applied = applyToSessions.data;

  return (
    <SettingsRow
      label="Factory default model"
      hint={
        <>
          <span>
            Factory runs (triage, board work items) start on this model and use the Factory observational-memory
            settings below — your personal defaults don&apos;t apply to them.
          </span>
          {error && (
            <Txt as="span" variant="ui-xs" className="text-notice-destructive-fg">
              {error instanceof Error ? error.message : String(error)}
            </Txt>
          )}
          <SharedCredentialNotice modelId={defaultModelId || undefined} />
          {applied && (
            <Txt as="span" variant="ui-xs" className="text-icon3">
              {`Switched ${applied.applied.length} running session${applied.applied.length === 1 ? '' : 's'} to ${applied.modelId}.`}
              {applied.skipped.length > 0 &&
                ` ${applied.skipped.length} idle session${applied.skipped.length === 1 ? '' : 's'} will pick it up on the next start.`}
            </Txt>
          )}
        </>
      }
    >
      <div className="flex w-full max-w-96 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={!defaultModelId || applyToSessions.isPending}
          onClick={() => applyToSessions.mutate()}
        >
          {applyToSessions.isPending ? 'Applying…' : 'Apply to running sessions'}
        </Button>
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
