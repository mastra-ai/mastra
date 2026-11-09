import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { SettingsItem, SettingsItemIcon } from '@mastra/playground-ui/new/settings';
import { AppWindow } from 'lucide-react';
import type { ReactNode } from 'react';

import { GitLabIcon, IncidentIoIcon, JiraIcon } from '../../../../../ui/icons';
import type { FactoryModelScope } from '../../../../workspaces/services/github';
import { FactoryDefaultModel } from '../defaults/FactoryDefaultModel';
import { PersonalDefaultModel } from '../defaults/PersonalDefaultModel';
import { ProviderList } from '../providers/ProviderList';
import { DefaultsSection } from './DefaultsSection';
import {
  MODEL_DEFAULTS_LABELS,
  MODEL_LANE_ICONS,
  MODEL_LANE_LABELS,
  MODEL_LANES,
  MODEL_ROUTES,
  defaultsInUse,
} from './model-routes';
import type { ModelLane } from './model-routes';

const LANE_SOURCES: Record<ModelLane, Array<{ label: string; icon: ReactNode }>> = {
  chats: [
    { label: 'Web app', icon: <AppWindow /> },
    { label: 'Slack', icon: <SlackIcon /> },
  ],
  runs: [
    { label: 'GitHub', icon: <GithubIcon /> },
    { label: 'GitLab', icon: <GitLabIcon /> },
    { label: 'Linear', icon: <LinearIcon /> },
    { label: 'Jira', icon: <JiraIcon /> },
    { label: 'incident.io', icon: <IncidentIoIcon /> },
  ],
};

/** The routing card's rows: where chats and work-item runs come from, and which defaults each uses. */
export function ModelLaneItems({ modelScope }: { modelScope: FactoryModelScope }) {
  const routes = MODEL_ROUTES[modelScope];
  return MODEL_LANES.map(lane => {
    const Icon = MODEL_LANE_ICONS[lane];
    return (
      <SettingsItem
        key={lane}
        role="group"
        aria-label={MODEL_LANE_LABELS[lane]}
        media={
          <SettingsItemIcon>
            <Icon />
          </SettingsItemIcon>
        }
        title={MODEL_LANE_LABELS[lane]}
        description={`Uses ${MODEL_DEFAULTS_LABELS[routes[lane]]}`}
      >
        <ul className="text-muted-foreground flex flex-wrap items-center justify-end gap-2.5 [&_svg]:size-3.5">
          {LANE_SOURCES[lane].map(source => (
            <li key={source.label} title={source.label} className="flex">
              {source.icon}
              <span className="sr-only">{source.label}</span>
            </li>
          ))}
        </ul>
      </SettingsItem>
    );
  });
}

/** Personal and Factory defaults, each its own section: the model, then the providers that can run it. */
export function ModelDefaultsSections({ factoryId, modelScope }: { factoryId: string; modelScope: FactoryModelScope }) {
  return (
    <>
      <DefaultsSection
        defaults="personal"
        inUse={defaultsInUse(modelScope, 'personal')}
        model={<PersonalDefaultModel />}
        providers={<ProviderList credentialScope="user" />}
      />
      <DefaultsSection
        defaults="factory"
        inUse={defaultsInUse(modelScope, 'factory')}
        model={<FactoryDefaultModel factoryId={factoryId} />}
        providers={<ProviderList credentialScope="org" />}
      />
    </>
  );
}
