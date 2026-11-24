import { defaultModelPack } from '@mastra/factory/model-packs';
import type { ModelPackSet } from '@mastra/factory/model-packs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { useOrgKeyAdminQuery } from '../../../../../../hooks/use-providers';
import { useAvailableModelsQuery } from '../../../../../../hooks/useAvailableModels';
import {
  useApplyFactoryDefaultModelMutation,
  useFactoryProjectQuery,
  useSetFactoryModelPacksMutation,
} from '../../../../../../hooks/useFactoryDefaultModel';
import { SharedCredentialNotice } from '../../SharedCredentialNotice';
import { SwitchRunningSessionsDialog } from '../defaults/SwitchRunningSessionsDialog';
import { ModelPackList } from './ModelPackList';

function packWriteFailureMessage(error: Error | null): string | undefined {
  if (!error) return undefined;
  if ('status' in error && error.status === 403) return 'Only organization admins can change Factory model packs';
  return error.message;
}

export function FactoryModelPacks({ factoryId }: { factoryId: string }) {
  const projectQuery = useFactoryProjectQuery(factoryId);
  const isAdminQuery = useOrgKeyAdminQuery();
  const modelsQuery = useAvailableModelsQuery({ scope: 'org' });
  const savePacks = useSetFactoryModelPacksMutation(factoryId);
  const applyToSessions = useApplyFactoryDefaultModelMutation(factoryId);
  const [confirmModelId, setConfirmModelId] = useState<string>();

  if (projectQuery.error) {
    return (
      <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
        {projectQuery.error.message}
      </Txt>
    );
  }
  if (!projectQuery.data) return null;

  const packSet: ModelPackSet = {
    modelPacks: projectQuery.data.modelPacks ?? [],
    defaultModelPackId: projectQuery.data.defaultModelPackId ?? null,
  };
  const defaultModelId = defaultModelPack(packSet)?.models[0]?.modelId;

  const save = async (next: ModelPackSet) => {
    applyToSessions.reset();
    await savePacks.mutateAsync(next);
    const nextDefaultModelId = defaultModelPack(next)?.models[0]?.modelId;
    if (nextDefaultModelId && nextDefaultModelId !== defaultModelId) setConfirmModelId(nextDefaultModelId);
  };

  return (
    <>
      <div className="flex min-w-0 flex-col gap-2">
        <ModelPackList
          label="Factory model packs"
          packSet={packSet}
          models={modelsQuery.data}
          readOnly={isAdminQuery.data === false}
          saving={savePacks.isPending}
          error={packWriteFailureMessage(savePacks.error) ?? applyToSessions.error?.message}
          onSave={save}
        />
        <SharedCredentialNotice modelId={defaultModelId} />
        {applyToSessions.data && (
          <Txt as="p" variant="meta" role="status">
            Switch started in the background. Running sessions will pick up the new model on their next step.
          </Txt>
        )}
      </div>

      {confirmModelId && (
        <SwitchRunningSessionsDialog
          modelId={confirmModelId}
          pending={applyToSessions.isPending}
          onConfirm={() => applyToSessions.mutate(undefined, { onSuccess: () => setConfirmModelId(undefined) })}
          onClose={() => setConfirmModelId(undefined)}
        />
      )}
    </>
  );
}
