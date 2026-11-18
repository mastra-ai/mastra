import { SettingsItem, SettingsItemIcon } from '@mastra/playground-ui/new/settings';
import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
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
      description={error ? <IntegrationError description={description} error={error} /> : description}
      {...props}
    />
  );
}

export function IntegrationItemSkeleton({
  provider,
  name,
  label,
}: {
  provider: IntegrationProvider;
  name: ReactNode;
  label: string;
}) {
  return (
    <IntegrationItem
      provider={provider}
      name={name}
      description={
        <span role="status" aria-label={label}>
          <SkeletonText line="text-caption" className="w-48 max-w-full motion-reduce:before:animate-none" />
        </span>
      }
    />
  );
}

/** The description followed by the error, in the destructive tone. */
function IntegrationError({ description, error }: { description: ReactNode; error: ReactNode }) {
  return (
    <Metadata>
      {description != null && <Metadata.Item>{description}</Metadata.Item>}
      <Metadata.Item className="text-destructive-foreground">{error}</Metadata.Item>
    </Metadata>
  );
}
