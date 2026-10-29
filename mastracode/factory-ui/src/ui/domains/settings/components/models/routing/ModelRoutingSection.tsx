import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import {
  useFactoryProjectQuery,
  useSetFactoryModelScopeMutation,
} from '../../../../../../hooks/useFactoryDefaultModel';
import { ModelRoutingSkeleton } from './ModelRoutingSkeleton';
import type { FactoryModelScope } from '../../../../workspaces/services/github';
import { SettingsSubsection } from '../../SettingsSubsection';
import { savedModelScope } from './model-routes';
import { ModelRoutingChangeDialog } from './ModelRoutingChangeDialog';
import { ModelRoutingMap } from './ModelRoutingMap';
import { ModelRoutingSwitch } from './ModelRoutingSwitch';

export function ModelRoutingSection({ factoryId }: { factoryId: string }) {
  const projectQuery = useFactoryProjectQuery(factoryId);
  const setModelScope = useSetFactoryModelScopeMutation(factoryId);
  const [requestedScope, setRequestedScope] = useState<FactoryModelScope>();
  const pendingScope = setModelScope.isPending ? setModelScope.variables : undefined;
  const savedScope = projectQuery.data && savedModelScope(projectQuery.data);
  const modelScope = pendingScope ?? savedScope;
  const error = setModelScope.error ?? projectQuery.error;

  const pickScope = (scope: FactoryModelScope) => {
    if (scope === modelScope || setModelScope.isPending) return;
    setRequestedScope(scope);
  };

  const confirmScope = (scope: FactoryModelScope) => {
    setRequestedScope(undefined);
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
        {projectQuery.isPending && <ModelRoutingSkeleton />}
        {modelScope && <ModelRoutingMap factoryId={factoryId} modelScope={modelScope} />}
        {modelScope && (
          <ModelRoutingChangeDialog
            from={modelScope}
            to={requestedScope}
            onConfirm={confirmScope}
            onCancel={() => setRequestedScope(undefined)}
          />
        )}
      </div>
    </SettingsSubsection>
  );
}
