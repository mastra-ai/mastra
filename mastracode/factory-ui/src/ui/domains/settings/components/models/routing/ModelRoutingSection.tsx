import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsNoticeRow, SettingsSkeleton } from '@mastra/playground-ui/new/settings';
import { useState } from 'react';

import {
  useFactoryProjectQuery,
  usePendingFactoryModelScope,
  useSetFactoryModelScopeMutation,
} from '../../../../../../hooks/useFactoryDefaultModel';
import type { FactoryModelScope } from '../../../../workspaces/services/github';
import { SettingsSubsection } from '../../SettingsSubsection';
import { savedModelScope } from './model-routes';
import { ModelRoutingChangeDialog } from './ModelRoutingChangeDialog';
import { ModelDefaultsSections, ModelLaneItems } from './ModelRoutingMap';
import { ModelRoutingSwitch } from './ModelRoutingSwitch';

// Keyed by Factory so a pending request is dropped on a Factory switch and never saves or reopens elsewhere.
export function ModelRoutingSection({ factoryId }: { factoryId: string }) {
  return <FactoryModelRouting key={factoryId} factoryId={factoryId} />;
}

function FactoryModelRouting({ factoryId }: { factoryId: string }) {
  const projectQuery = useFactoryProjectQuery(factoryId);
  const setModelScope = useSetFactoryModelScopeMutation(factoryId);
  const [requestedScope, setRequestedScope] = useState<FactoryModelScope>();
  const pendingScope = usePendingFactoryModelScope(factoryId);
  const saving = pendingScope !== undefined;
  const savedScope = projectQuery.data && savedModelScope(projectQuery.data);
  const modelScope = pendingScope ?? savedScope;
  const error = setModelScope.error ?? projectQuery.error;

  const pickScope = (scope: FactoryModelScope) => {
    if (scope === modelScope || saving) return;
    setRequestedScope(scope);
  };

  const confirmScope = (scope: FactoryModelScope) => {
    setRequestedScope(undefined);
    setModelScope.mutate(scope);
  };

  return (
    <>
      <SettingsSubsection
        scope="factory"
        title="Model routing"
        description="Which defaults chats and work-item runs use. Running threads keep the model they already picked."
        action={modelScope && <ModelRoutingSwitch value={modelScope} pending={saving} onValueChange={pickScope} />}
      >
        <SettingsContainer>
          {projectQuery.isPending && <SettingsSkeleton label="Loading model routing" variant="item" rows={2} />}
          {modelScope && <ModelLaneItems modelScope={modelScope} />}
          <SettingsNoticeRow>
            {error && (
              <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
                {error.message}
              </Txt>
            )}
          </SettingsNoticeRow>
        </SettingsContainer>
        {modelScope && (
          <ModelRoutingChangeDialog
            from={modelScope}
            to={requestedScope}
            onConfirm={confirmScope}
            onCancel={() => setRequestedScope(undefined)}
          />
        )}
      </SettingsSubsection>
      {projectQuery.isPending && (
        <SettingsContainer>
          <SettingsSkeleton label="Loading model defaults" variant="item" rows={2} />
        </SettingsContainer>
      )}
      {modelScope && <ModelDefaultsSections factoryId={factoryId} modelScope={modelScope} />}
    </>
  );
}
