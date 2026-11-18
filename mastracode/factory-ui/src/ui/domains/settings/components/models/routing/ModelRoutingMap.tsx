import { useState } from 'react';

import type { FactoryModelScope } from '../../../../workspaces/services/github';
import { FactoryDefaultModel } from '../defaults/FactoryDefaultModel';
import { PersonalDefaultModel } from '../defaults/PersonalDefaultModel';
import { ProviderList } from '../providers/ProviderList';
import { DefaultsCard } from './DefaultsCard';
import { LaneCard, LaneDestination } from './LaneCard';
import { MODEL_ROUTES, defaultsInUse } from './model-routes';
import { RoutingMapLayout, createConnectorAnchors } from './RoutingMapLayout';

export function ModelRoutingMap({ factoryId, modelScope }: { factoryId: string; modelScope: FactoryModelScope }) {
  const routes = MODEL_ROUTES[modelScope];
  const [anchors] = useState(createConnectorAnchors);

  return (
    <RoutingMapLayout
      connectors={{ anchors, routes }}
      lanes={
        <>
          <LaneCard lane="chats" destination={<LaneDestination defaults={routes.chats} />} anchorRef={anchors.chats} />
          <LaneCard lane="runs" destination={<LaneDestination defaults={routes.runs} />} anchorRef={anchors.runs} />
        </>
      }
      defaults={
        <>
          <DefaultsCard
            defaults="personal"
            inUse={defaultsInUse(modelScope, 'personal')}
            anchorRef={anchors.personal}
            model={<PersonalDefaultModel />}
            providers={<ProviderList credentialScope="user" />}
          />
          <DefaultsCard
            defaults="factory"
            inUse={defaultsInUse(modelScope, 'factory')}
            anchorRef={anchors.factory}
            model={<FactoryDefaultModel factoryId={factoryId} />}
            providers={<ProviderList credentialScope="org" />}
          />
        </>
      }
    />
  );
}
