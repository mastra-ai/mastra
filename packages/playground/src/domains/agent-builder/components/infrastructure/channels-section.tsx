import type { InfrastructureStatusResponse } from '@mastra/client-js';
import {
  SettingsContainer,
  SettingsEmptyRow,
  SettingsGroup,
  SettingsItem,
  SettingsTitle,
} from '@mastra/playground-ui/new/settings';
import { titleCase } from './format-infrastructure-value';
import { InfrastructureStatusBadge } from './infrastructure-status-badge';

export interface ChannelsSectionProps {
  providers: InfrastructureStatusResponse['channels']['providers'];
}

export const ChannelsSection = ({ providers }: ChannelsSectionProps) => (
  <SettingsGroup>
    <SettingsTitle info="Configured channel providers available to Agent Builder publish/share flows. Unconfigured providers are omitted until their required environment/config is present.">
      Channels
    </SettingsTitle>
    <SettingsContainer>
      {providers.length === 0 ? (
        <SettingsEmptyRow>No configured channel providers for Agent Builder.</SettingsEmptyRow>
      ) : (
        providers.map(provider => (
          <SettingsItem
            key={provider.id}
            title={titleCase(provider.name)}
            description={`Provider ID: ${provider.id}, ${provider.routeCount} provider routes`}
          >
            <InfrastructureStatusBadge
              ok={provider.isConfigured}
              label={provider.isConfigured ? 'Configured' : 'Not configured'}
            />
          </SettingsItem>
        ))
      )}
    </SettingsContainer>
  </SettingsGroup>
);
