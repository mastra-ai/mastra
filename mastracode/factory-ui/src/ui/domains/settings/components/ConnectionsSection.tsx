import { SettingsContainer } from '@mastra/playground-ui/new/settings';

import { ConnectedAccountsSection } from './ConnectedAccountsSection';
import { SettingsSubsection } from './SettingsSubsection';
import { UserGithubConnectionRow } from './UserGithubConnectionRow';

export function ConnectionsSection() {
  return (
    <SettingsSubsection scope="personal" title="Connected accounts">
      <SettingsContainer>
        <UserGithubConnectionRow />
        <ConnectedAccountsSection />
      </SettingsContainer>
    </SettingsSubsection>
  );
}
