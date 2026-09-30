import { Switch } from '@mastra/playground-ui/components/Switch';
import { SettingsRow } from '@mastra/playground-ui/new/settings';

import type { Storyboard } from './StoryboardProvider';
import { PolicyBlock } from './StorySettingControls';
import { ownPlansAllowed } from './storyState';
import type { AllowedConnections } from './storyState';
import { settingsAnchorId } from './storyLinks';

const CONNECTIONS: { key: keyof AllowedConnections; label: string; note?: string }[] = [
  { key: 'subscriptions', label: 'Personal subscriptions' },
  { key: 'personalKeys', label: 'Personal API keys' },
  { key: 'companyKeys', label: 'Company keys', note: 'Lets personal sessions spend the Factory account.' },
];

export function StorySessionPolicySettings({ storyboard: { state, patch } }: { storyboard: Storyboard }) {
  const connections = ownPlansAllowed(state)
    ? CONNECTIONS
    : CONNECTIONS.filter(connection => connection.key === 'companyKeys');
  return (
    <PolicyBlock id={settingsAnchorId('personal-sessions')} title="Personal sessions">
      <SettingsRow label="Allow personal sessions">
        <Switch
          aria-label="Allow personal sessions"
          checked={state.personalSessions}
          onCheckedChange={personalSessions => patch({ personalSessions })}
        />
      </SettingsRow>
      {state.personalSessions &&
        connections.map(connection => (
          <SettingsRow key={connection.key} label={connection.label} description={connection.note}>
            <Switch
              aria-label={`Allow ${connection.label.toLowerCase()}`}
              checked={state.allowed[connection.key]}
              onCheckedChange={next => patch({ allowed: { ...state.allowed, [connection.key]: next } })}
            />
          </SettingsRow>
        ))}
    </PolicyBlock>
  );
}
