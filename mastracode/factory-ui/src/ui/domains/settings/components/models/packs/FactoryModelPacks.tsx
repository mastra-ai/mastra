import { defaultModelPack } from '@mastra/factory/model-packs';
import type { ModelPackSet } from '@mastra/factory/model-packs';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useOrgKeyAdminQuery } from '../../../../../../hooks/use-providers';
import { useScopeModelCatalogQuery } from '../../../../../../hooks/useAvailableModels';
import {
  useFactoryProjectQuery,
  useSetFactoryModelPacksMutation,
} from '../../../../../../hooks/useFactoryDefaultModel';
import { SharedCredentialNotice } from '../../SharedCredentialNotice';
import { ModelPackList } from './ModelPackList';

function packWriteFailureMessage(error: Error | null): string | undefined {
  if (!error) return undefined;
  if ('status' in error && error.status === 403) return 'Only organization admins can change Factory model packs';
  return error.message;
}

export function FactoryModelPacks({ factoryId }: { factoryId: string }) {
  const projectQuery = useFactoryProjectQuery(factoryId);
  const isAdminQuery = useOrgKeyAdminQuery();
  const catalogQuery = useScopeModelCatalogQuery('org');
  const savePacks = useSetFactoryModelPacksMutation(factoryId);

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

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ModelPackList
        label="Factory model packs"
        packSet={packSet}
        models={catalogQuery.data?.models}
        startModelId={catalogQuery.data?.fallbackModelId}
        readOnly={isAdminQuery.data === false}
        saving={savePacks.isPending}
        error={packWriteFailureMessage(savePacks.error)}
        onSave={next => savePacks.mutateAsync(next)}
      />
      <SharedCredentialNotice modelId={defaultModelPack(packSet)?.models[0]?.modelId} />
    </div>
  );
}
