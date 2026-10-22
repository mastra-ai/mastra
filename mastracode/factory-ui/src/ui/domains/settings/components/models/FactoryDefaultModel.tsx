import {
  Dialog,
  DialogAction,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import { useState } from 'react';

import { useAvailableModelsQuery } from '../../../../../hooks/useAvailableModels';
import {
  useApplyFactoryDefaultModelMutation,
  useFactoryProjectQuery,
  useSetFactoryDefaultModelMutation,
} from '../../../../../hooks/useFactoryDefaultModel';
import { ModelCombobox } from '../ModelCombobox';
import { SharedCredentialNotice } from '../SharedCredentialNotice';
import { AppliedSessionsSummary } from './AppliedSessionsSummary';

export function FactoryDefaultModel({ factoryId }: { factoryId: string }) {
  const projectQuery = useFactoryProjectQuery(factoryId);
  const modelsQuery = useAvailableModelsQuery({ factoryProjectId: factoryId });
  const setDefaultModel = useSetFactoryDefaultModelMutation(factoryId);
  const applyToSessions = useApplyFactoryDefaultModelMutation(factoryId);
  const [confirmModelId, setConfirmModelId] = useState<string>();

  const defaultModelId = projectQuery.data?.defaultModelId ?? '';
  const errorText = (applyToSessions.error ?? setDefaultModel.error ?? projectQuery.error)?.message;

  const saveDefaultModel = (value: string) => {
    if (value === defaultModelId) return;
    applyToSessions.reset();
    setDefaultModel.mutate(value, { onSuccess: () => setConfirmModelId(value) });
  };

  const switchRunningSessions = () => {
    applyToSessions.mutate(undefined, { onSuccess: () => setConfirmModelId(undefined) });
  };

  return (
    <>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          <ModelCombobox
            models={modelsQuery.data ?? []}
            value={defaultModelId}
            onValueChange={saveDefaultModel}
            placeholder="Select a model"
            aria-label="Factory default model"
            size="sm"
            className="min-w-0 flex-1"
            disabled={projectQuery.isPending || setDefaultModel.isPending}
          />
          {setDefaultModel.isPending && (
            <Spinner size="sm" aria-label="Saving default model" className="text-muted-foreground shrink-0" />
          )}
        </div>
        {errorText && (
          <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
            {errorText}
          </Txt>
        )}
        <SharedCredentialNotice modelId={defaultModelId || undefined} />
        {applyToSessions.data && <AppliedSessionsSummary result={applyToSessions.data} />}
      </div>

      {confirmModelId && (
        <Dialog open onOpenChange={open => !open && setConfirmModelId(undefined)} pending={applyToSessions.isPending}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Also switch running sessions to {formatModelName(confirmModelId)}?</DialogTitle>
              <DialogDescription>
                New activity using the Factory defaults will use this model. Running work and review sessions keep their
                current model unless you switch them. Switched sessions keep their work and pick up the new model on
                their next step.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogCancel>Keep them as-is</DialogCancel>
              <DialogAction onConfirm={switchRunningSessions}>
                {applyToSessions.isPending ? 'Switching…' : 'Switch running sessions'}
              </DialogAction>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
