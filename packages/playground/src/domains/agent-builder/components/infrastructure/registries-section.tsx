import type { InfrastructureStatusResponse } from '@mastra/client-js';
import { SettingsContainer, SettingsGroup, SettingsItem, SettingsTitle } from '@mastra/playground-ui/new/settings';
import { InfrastructureStatusBadge } from './infrastructure-status-badge';

export interface RegistriesSectionProps {
  registries: InfrastructureStatusResponse['registries'];
}

export const RegistriesSection = ({ registries }: RegistriesSectionProps) => {
  const skillsShEnabled = registries?.skillsSh?.enabled ?? false;

  return (
    <SettingsGroup>
      <SettingsTitle info="External skill registries available to import skills into the workspace.">
        Registries
      </SettingsTitle>
      <SettingsContainer>
        <SettingsItem title="skills.sh" description="GitHub-backed public skills registry.">
          <InfrastructureStatusBadge ok={skillsShEnabled} label={skillsShEnabled ? 'Enabled' : 'Disabled'} />
        </SettingsItem>
      </SettingsContainer>
    </SettingsGroup>
  );
};
