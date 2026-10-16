import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import type { MouseEvent } from 'react';
import { useRef, useState } from 'react';
import { useParams } from 'react-router';

import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import {
  useApplyFactoryDefaultModelMutation,
  useFactoryProjectQuery,
  useSetFactoryDefaultModelMutation,
} from '../../../../hooks/useFactoryDefaultModel';

import { FactoryThinkingControl } from './FactoryThinkingControl';
import { ModelCombobox } from './ModelCombobox';
import { SharedCredentialNotice } from './SharedCredentialNotice';

function skippedReasonSummary(reasons: Array<{ reason: string }>) {
  const counts = new Map<string, number>();
  for (const { reason } of reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  return [...counts.entries()].map(([reason, count]) => `${reason.replaceAll('-', ' ')} (${count})`).join(', ');
}

export function FactoryDefaultModelSection({ models }: { models: AvailableModelOption[] }) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const projectQuery = useFactoryProjectQuery(factoryId);
  const setDefaultModel = useSetFactoryDefaultModelMutation(factoryId);
  const applyToSessions = useApplyFactoryDefaultModelMutation(factoryId ?? '');
  const [confirmModelId, setConfirmModelId] = useState<string>();
  const applyRequested = useRef(false);

  if (!factoryId) return null;

  const defaultModelId = projectQuery.data?.defaultModelId ?? '';
  const errorText = (applyToSessions.error ?? setDefaultModel.error ?? projectQuery.error)?.message;
  const applyResult = applyToSessions.data;

  const saveDefaultModel = (value: string) => {
    if (value === defaultModelId) return;
    applyToSessions.reset();
    setDefaultModel.mutate(value, { onSuccess: () => setConfirmModelId(value) });
  };

  const setDialogOpen = (open: boolean) => {
    if (!open && !applyRequested.current) setConfirmModelId(undefined);
  };

  const switchRunningSessions = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    applyRequested.current = true;
    applyToSessions.mutate(undefined, {
      onSuccess: () => setConfirmModelId(undefined),
      onSettled: () => {
        applyRequested.current = false;
      },
    });
  };

  return (
    <>
      <SettingsRow
        label="Model and thinking"
        description={
          <>
            <span>
              {projectQuery.data?.modelScope === 'hybrid'
                ? "Work items (triage, board runs) start on this model and run on organization credentials. Interactive sessions start on each owner's personal default instead."
                : "Factory runs (triage, board work items) start on this model and use the Factory memory settings. Your personal defaults don't apply to them."}
            </span>
            {errorText && (
              <Txt as="span" variant="meta" className="text-destructive-foreground">
                {errorText}
              </Txt>
            )}
            <SharedCredentialNotice modelId={defaultModelId || undefined} />
          </>
        }
      >
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex items-center gap-2">
            {setDefaultModel.isPending && (
              <Spinner size="sm" aria-label="Saving default model" className="text-muted-foreground shrink-0" />
            )}
            <ButtonsGroup size="sm" aria-label="Model and thinking">
              <ModelCombobox
                models={models}
                value={defaultModelId}
                onValueChange={saveDefaultModel}
                placeholder="Select a model"
                aria-label="Factory default model"
                variant="ghost"
                size="sm"
                disabled={projectQuery.isPending || setDefaultModel.isPending}
              />
              <FactoryThinkingControl factoryId={factoryId} />
            </ButtonsGroup>
          </div>
          {applyResult && (
            <Txt variant="meta">
              {applyResult.applied.length > 0
                ? `Switched ${applyResult.applied.length} session${applyResult.applied.length === 1 ? '' : 's'}`
                : 'No running sessions to switch'}
              {applyResult.skipped.length > 0 && (
                <>
                  . {applyResult.skipped.length} skipped: {skippedReasonSummary(applyResult.skipped)}
                </>
              )}
            </Txt>
          )}
        </div>
      </SettingsRow>

      <AlertDialog open={!!confirmModelId} onOpenChange={setDialogOpen}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>
              Also switch running sessions to {confirmModelId ? formatModelName(confirmModelId) : ''}?
            </AlertDialog.Title>
            <AlertDialog.Description>
              New Factory runs will use this model. Running work and review sessions keep their current model unless you
              switch them. Switched sessions keep their work and pick up the new model on their next step.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel disabled={applyToSessions.isPending}>Keep them as-is</AlertDialog.Cancel>
            <AlertDialog.Action disabled={applyToSessions.isPending} onClick={switchRunningSessions}>
              Switch running sessions
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}
