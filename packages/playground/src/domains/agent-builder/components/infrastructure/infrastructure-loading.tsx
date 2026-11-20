import { SettingsContainer, SettingsGroup, SettingsSkeleton, SettingsTitle } from '@mastra/playground-ui/new/settings';

export const InfrastructureLoading = () => (
  <SettingsGroup>
    <SettingsTitle>Agent Builder</SettingsTitle>
    <SettingsContainer>
      <SettingsSkeleton label="Loading infrastructure configuration" variant="item" rows={3} />
    </SettingsContainer>
  </SettingsGroup>
);
