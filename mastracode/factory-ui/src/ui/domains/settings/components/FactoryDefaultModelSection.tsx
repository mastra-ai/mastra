import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
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
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
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
  const outcome = applyToSessions.data;

  return (
    <SettingsRow
      variant="factory"
      label="Factory default model"
      description={
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
        </>
      }
    >
      <div className="flex w-full max-w-72 flex-col items-end gap-1.5">
        <div className="flex w-full items-center gap-2">
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
        {/* Secondary action: the setting already applies to everything that
            starts later, so this only exists to catch sessions mid-flight.
            Confirmed, because it reaches into runs that are already going. */}
        <AlertDialog>
          <AlertDialog.Trigger
            render={<button type="button" />}
            className="text-icon3 hover:text-icon6 disabled:hover:text-icon3 text-ui-xs underline underline-offset-2 disabled:cursor-default disabled:opacity-60"
            disabled={!defaultModelId || applyToSessions.isPending}
          >
            {applyToSessions.isPending ? 'Applying to running sessions…' : 'Also apply to running sessions'}
          </AlertDialog.Trigger>
          <AlertDialog.Content>
            <AlertDialog.Header>
              <AlertDialog.Title>Apply {defaultModelId} to running sessions?</AlertDialog.Title>
              <AlertDialog.Description>
                Every Factory session currently running switches to this model and keeps going on it. Work already done
                is kept, and nothing is interrupted. Idle sessions are left alone — they pick the model up when they
                next start.
              </AlertDialog.Description>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
              <AlertDialog.Action onClick={() => applyToSessions.mutate()}>Apply</AlertDialog.Action>
            </AlertDialog.Footer>
          </AlertDialog.Content>
        </AlertDialog>
        {outcome && (
          <Txt as="span" variant="ui-xs" className="text-icon3 text-right">
            {outcome.applied.length === 0
              ? 'No running sessions to switch.'
              : `Switched ${outcome.applied.length} running session${outcome.applied.length === 1 ? '' : 's'}.`}
            {outcome.skipped.length > 0 &&
              ` ${outcome.skipped.length} idle session${outcome.skipped.length === 1 ? '' : 's'} will pick it up on the next start.`}
          </Txt>
        )}
      </div>
    </SettingsRow>
  );
}
