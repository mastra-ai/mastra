import { SettingsItem, SettingsItemIcon } from '@mastra/playground-ui/new/settings';
import { Metadata } from '@mastra/playground-ui/components/Metadata';
import type { SettingsItemProps } from '@mastra/playground-ui/new/settings';
import type { ComponentProps, ReactNode } from 'react';

import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';

export type IntegrationProvider = ComponentProps<typeof SettingsIntegrationIcon>['provider'];

export function IntegrationItemIcon({ provider }: { provider: IntegrationProvider }) {
  return (
    <SettingsItemIcon>
      <SettingsIntegrationIcon provider={provider} />
    </SettingsItemIcon>
  );
}

/** One connection in a settings list: the integration's logo and name, a line about it, and its actions. */
export function IntegrationItem({
  provider,
  name,
  description,
  error,
  ...props
}: Omit<SettingsItemProps, 'media' | 'title'> & {
  provider: IntegrationProvider;
  name: ReactNode;
  /** Shown in place of (or after) the description, in the destructive tone. */
  error?: ReactNode;
}) {
  return (
    <SettingsItem
      media={<IntegrationItemIcon provider={provider} />}
      title={name}
      description={
        error ? (
          <Metadata>
            {description != null && <Metadata.Item>{description}</Metadata.Item>}
            <Metadata.Item className="text-destructive-foreground">{error}</Metadata.Item>
          </Metadata>
        ) : (
          description
        )
      }
      {...props}
    />
  );
}
