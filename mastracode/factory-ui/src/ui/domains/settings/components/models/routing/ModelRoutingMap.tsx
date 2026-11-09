import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { AppWindow } from 'lucide-react';

import { GitLabIcon, IncidentIoIcon, JiraIcon } from '../../../../../ui/icons';
import type { FactoryModelScope } from '../../../../workspaces/services/github';
import { FactoryDefaultModel } from '../defaults/FactoryDefaultModel';
import { PersonalDefaultModel } from '../defaults/PersonalDefaultModel';
import { ProviderList } from '../providers/ProviderList';
import { DefaultsCard } from './DefaultsCard';
import { LaneItem, LaneSource } from './LaneItem';
import { MODEL_ROUTES, defaultsInUse } from './model-routes';

/** The routing card's rows: where chats and work-item runs come from, and which defaults each uses. */
export function ModelLaneItems({ modelScope }: { modelScope: FactoryModelScope }) {
  const routes = MODEL_ROUTES[modelScope];
  return (
    <>
      <LaneItem lane="chats" destination={routes.chats}>
        <LaneSource label="Web app">
          <AppWindow />
        </LaneSource>
        <LaneSource label="Slack">
          <SlackIcon />
        </LaneSource>
      </LaneItem>
      <LaneItem lane="runs" destination={routes.runs}>
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
      </LaneItem>
    </>
  );
}

/** Personal and Factory defaults: the model, then the providers that can run it. */
export function ModelDefaultsSections({ factoryId, modelScope }: { factoryId: string; modelScope: FactoryModelScope }) {
  return (
    <div className="grid gap-3">
      <DefaultsCard
        defaults="personal"
        inUse={defaultsInUse(modelScope, 'personal')}
        model={<PersonalDefaultModel />}
        providers={<ProviderList credentialScope="user" />}
      />
      <DefaultsCard
        defaults="factory"
        inUse={defaultsInUse(modelScope, 'factory')}
        model={<FactoryDefaultModel factoryId={factoryId} />}
        providers={<ProviderList credentialScope="org" />}
      />
    </div>
  );
}
