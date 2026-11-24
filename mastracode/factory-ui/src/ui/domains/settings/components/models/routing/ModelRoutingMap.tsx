import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { useState } from 'react';

import { GitLabIcon, IncidentIoIcon, JiraIcon } from '../../../../../ui/icons';
import type { FactoryModelScope } from '../../../../workspaces/services/github';
import { FactoryModelPacks } from '../packs/FactoryModelPacks';
import { PersonalModelPacks } from '../packs/PersonalModelPacks';
import { ProviderList } from '../providers/ProviderList';
import { DefaultsCard } from './DefaultsCard';
import { LaneCard, LaneSource } from './LaneCard';
import { MODEL_ROUTES, defaultsInUse } from './model-routes';
import { RoutingMapLayout, createConnectorAnchors } from './RoutingMapLayout';
import { IconWindow } from '@mastra/playground-ui/icons/central/IconWindow';

export function ModelRoutingMap({ factoryId, modelScope }: { factoryId: string; modelScope: FactoryModelScope }) {
  const routes = MODEL_ROUTES[modelScope];
  const [anchors] = useState(createConnectorAnchors);

  return (
    <RoutingMapLayout
      anchors={anchors}
      routes={routes}
      lanes={
        <>
          <LaneCard lane="chats" destination={routes.chats} anchorRef={anchors.chats}>
            <LaneSource label="Web app">
              <IconWindow />
            </LaneSource>
            <LaneSource label="Slack">
              <SlackIcon />
            </LaneSource>
          </LaneCard>
          <LaneCard lane="runs" destination={routes.runs} anchorRef={anchors.runs}>
            <LaneSource label="GitHub">
              <GithubIcon />
            </LaneSource>
            <LaneSource label="GitLab">
              <GitLabIcon />
            </LaneSource>
            <LaneSource label="Linear">
              <LinearIcon />
            </LaneSource>
            <LaneSource label="Jira">
              <JiraIcon />
            </LaneSource>
            <LaneSource label="incident.io">
              <IncidentIoIcon />
            </LaneSource>
          </LaneCard>
        </>
      }
      defaults={
        <>
          <DefaultsCard
            defaults="personal"
            inUse={defaultsInUse(modelScope, 'personal')}
            anchorRef={anchors.personal}
            packs={<PersonalModelPacks />}
            providers={<ProviderList credentialScope="user" />}
          />
          <DefaultsCard
            defaults="factory"
            inUse={defaultsInUse(modelScope, 'factory')}
            anchorRef={anchors.factory}
            packs={<FactoryModelPacks factoryId={factoryId} />}
            providers={<ProviderList credentialScope="org" />}
          />
        </>
      }
    />
  );
}
