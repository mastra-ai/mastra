import type { InfrastructureStatusResponse } from '@mastra/client-js';
import {
  SettingsContainer,
  SettingsEmptyRow,
  SettingsGroup,
  SettingsItem,
  SettingsTitle,
} from '@mastra/playground-ui/new/settings';
import { titleCase } from './format-infrastructure-value';
import { InfrastructureConfigRows } from './infrastructure-config-rows';
import { InfrastructureDetailRow } from './infrastructure-detail-row';
import { InfrastructureStatusBadge } from './infrastructure-status-badge';

type Browser = InfrastructureStatusResponse['browser'];

const BrowserRows = ({ browser, provider }: { browser: Browser; provider: string }) => (
  <>
    <SettingsItem title={titleCase(provider)}>
      <InfrastructureStatusBadge
        ok={browser.registered}
        label={browser.registered ? 'Provider available' : 'Provider missing'}
      />
    </SettingsItem>
    {browser.env ? <InfrastructureDetailRow label="Environment" value={titleCase(browser.env)} /> : null}
    <InfrastructureConfigRows entries={browser.config} />
  </>
);

export const BrowserSection = ({ browser }: { browser: Browser }) => (
  <SettingsGroup>
    <SettingsTitle info="Browser automation provider configured for builder agents, with only the non-default options passed in configuration.">
      Browser
    </SettingsTitle>
    <SettingsContainer>
      {browser.provider ? (
        <BrowserRows browser={browser} provider={browser.provider} />
      ) : (
        <SettingsEmptyRow>No browser configured.</SettingsEmptyRow>
      )}
    </SettingsContainer>
  </SettingsGroup>
);
