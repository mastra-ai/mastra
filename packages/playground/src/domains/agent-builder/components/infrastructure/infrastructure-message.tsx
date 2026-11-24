import { SettingsContainer, SettingsEmptyRow, SettingsGroup, SettingsTitle } from '@mastra/playground-ui/new/settings';

export const InfrastructureMessage = ({ message }: { message: string }) => (
  <SettingsGroup>
    <SettingsTitle>Agent Builder</SettingsTitle>
    <SettingsContainer>
      <SettingsEmptyRow>{message}</SettingsEmptyRow>
    </SettingsContainer>
  </SettingsGroup>
);
