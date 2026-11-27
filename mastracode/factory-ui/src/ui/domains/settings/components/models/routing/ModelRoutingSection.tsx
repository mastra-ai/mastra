import { ProviderRowsSkeleton } from '../providers/ProviderRows';
import { MODEL_DEFAULTS_ANCHORS, ModelRoutingView } from '@mastra/playground-ui/domains/factory';
import { useLocation } from 'react-router';
import { useState } from 'react';

import {
  useFactoryProjectQuery,
  usePendingFactoryModelScope,
  useSetFactoryModelScopeMutation,
} from '../../../../../../hooks/useFactoryDefaultModel';
import type { FactoryModelScope } from '../../../../workspaces/services/github';
import { FactoryModelPacks } from '../packs/FactoryModelPacks';
import { PersonalModelPacks } from '../packs/PersonalModelPacks';
import { ProviderList } from '../providers/ProviderList';
import { savedModelScope } from './model-routes';
import { ModelRoutingChangeDialog } from './ModelRoutingChangeDialog';

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

  const hash = useLocation().hash.slice(1);
  const openedDefaults = (['personal', 'factory'] as const).find(d => MODEL_DEFAULTS_ANCHORS[d] === hash);

  return (
    <ModelRoutingView
      scope={modelScope}
      loading={projectQuery.isPending}
      pending={saving}
      error={error?.message}
      onPickScope={pickScope}
      openedDefaults={openedDefaults}
      providersSkeleton={<ProviderRowsSkeleton />}
      personal={{ packs: <PersonalModelPacks />, providers: <ProviderList credentialScope="user" /> }}
      factory={{
        packs: <FactoryModelPacks factoryId={factoryId} />,
        providers: <ProviderList credentialScope="org" />,
      }}
    >
      {modelScope && (
        <ModelRoutingChangeDialog
          from={modelScope}
          to={requestedScope}
          onConfirm={confirmScope}
          onCancel={() => setRequestedScope(undefined)}
        />
      )}
    </ModelRoutingView>
  );
}
