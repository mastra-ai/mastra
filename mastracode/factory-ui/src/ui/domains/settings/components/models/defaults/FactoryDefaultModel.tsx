import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { useAvailableModelsQuery } from '../../../../../../hooks/useAvailableModels';
import {
  useApplyFactoryDefaultModelMutation,
  useFactoryProjectQuery,
  useSetFactoryDefaultModelMutation,
} from '../../../../../../hooks/useFactoryDefaultModel';
import { ModelCombobox } from '../../ModelCombobox';
import { SharedCredentialNotice } from '../../SharedCredentialNotice';
import { AppliedSessionsSummary } from './AppliedSessionsSummary';
import { FactoryThinkingControl } from './FactoryThinkingControl';
import { SwitchRunningSessionsDialog } from './SwitchRunningSessionsDialog';

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
          <ButtonsGroup size="sm" aria-label="Factory default model and thinking" className="min-w-0 flex-1">
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
            <FactoryThinkingControl factoryId={factoryId} />
          </ButtonsGroup>
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
        <SwitchRunningSessionsDialog
          modelId={confirmModelId}
          pending={applyToSessions.isPending}
          onConfirm={switchRunningSessions}
          onClose={() => setConfirmModelId(undefined)}
        />
      )}
    </>
  );
}
