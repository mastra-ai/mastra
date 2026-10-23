import { Txt } from '@mastra/playground-ui/components/Txt';

import {
  useFactoryProjectQuery,
  useSetFactoryModelScopeMutation,
} from '../../../../../../hooks/useFactoryDefaultModel';
import { SkeletonRows } from '../../../../../ui/SkeletonRows';
import type { FactoryModelScope } from '../../../../workspaces/services/github';
import { SettingsSubsection } from '../../SettingsSubsection';
import { savedModelScope } from './model-routes';
import { ModelRoutingMap } from './ModelRoutingMap';
import { ModelRoutingSwitch } from './ModelRoutingSwitch';

export function ModelRoutingSection({ factoryId }: { factoryId: string }) {
  const projectQuery = useFactoryProjectQuery(factoryId);
  const setModelScope = useSetFactoryModelScopeMutation(factoryId);
  const pendingScope = setModelScope.isPending ? setModelScope.variables : undefined;
  const savedScope = projectQuery.data && savedModelScope(projectQuery.data);
  const modelScope = pendingScope ?? savedScope;
  const error = setModelScope.error ?? projectQuery.error;

  const pickScope = (scope: FactoryModelScope) => {
    if (scope === modelScope || setModelScope.isPending) return;
    setModelScope.mutate(scope);
  };

  return (
    <SettingsSubsection
      scope="factory"
      title="Model routing"
      description="Which defaults chats and work-item runs use. Running threads keep the model they already picked."
      action={
        modelScope && (
          <ModelRoutingSwitch value={modelScope} pending={setModelScope.isPending} onValueChange={pickScope} />
        )
      }
    >
      <div className="flex flex-col gap-6">
        {error && (
          <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
            {error.message}
          </Txt>
        )}
        {projectQuery.isPending && <SkeletonRows label="Loading model routing" rows={2} rowClassName="h-36 w-full" />}
        {modelScope && <ModelRoutingMap factoryId={factoryId} modelScope={modelScope} />}
      </div>
    </SettingsSubsection>
  );
}
