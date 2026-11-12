import { Button } from '@mastra/playground-ui/components/Button';
import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  SettingsContainer,
  SettingsEmptyRow,
  SettingsItem,
  SettingsItemIcon,
  SettingsListHeader,
  SettingsSkeleton,
} from '@mastra/playground-ui/new/settings';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';

import { useConnectToolsQuery } from '../../../../hooks/useConnectTools';
import { isConnectToolsOffError, MASTRA_PLATFORM_URL } from '../../factory/services/platformConnect';
import type { ConnectToolConnection } from '../../factory/services/platformConnect';
import { SettingsSubsection } from './SettingsSubsection';
import { RetryRow } from './common/ConnectionStateRows';

const SECTION_LABEL = 'Mastra Connect';

export function ConnectToolsSection() {
  const query = useConnectToolsQuery();
  const unavailable = query.isError && isConnectToolsOffError(query.error);

  return (
    <SettingsSubsection
      scope="deployment"
      title="Mastra Connect tools"
      description="Sessions can use the Mastra Connect tools of every connection attached to this Factory's Platform project. They run without asking for approval. Tools named for deleting or archiving, and GitHub and GitLab tools, are left out."
    >
      {query.isPending ? (
        <SettingsContainer>
          <SettingsSkeleton variant="item" label="Loading Mastra Connect tools" />
        </SettingsContainer>
      ) : unavailable ? (
        <Notice variant="info">
          <Notice.Message>
            Mastra Connect tools are off: this Factory sets a custom <InlineCode>tools</InlineCode> option or is missing
            Platform credentials or <InlineCode>MASTRA_PROJECT_ID</InlineCode>.
          </Notice.Message>
        </Notice>
      ) : query.isError ? (
        <SettingsContainer>
          <RetryRow
            label={SECTION_LABEL}
            errorMsg="Couldn't load Mastra Connect tools."
            onRetry={() => void query.refetch()}
          />
        </SettingsContainer>
      ) : query.data.length === 0 ? (
        <SettingsContainer>
          <SettingsEmptyRow action={<ManageLink />}>
            No connections are attached to this Factory's project yet.
          </SettingsEmptyRow>
        </SettingsContainer>
      ) : (
        <SettingsContainer>
          <SettingsListHeader action={<ManageLink />}>
            {query.data.length === 1 ? '1 connection' : `${query.data.length} connections`}
          </SettingsListHeader>
          {query.data.map(connection => (
            <SettingsItem
              key={connection.id}
              media={<ProviderLogo connection={connection} />}
              title={connection.providerName}
              description={<ConnectionDescription connection={connection} />}
            />
          ))}
        </SettingsContainer>
      )}
    </SettingsSubsection>
  );
}

function statusLabel(status: string): string | undefined {
  if (status === 'active') return undefined;
  if (status === 'needs_reauth') return 'Needs reconnecting';
  return 'Unavailable';
}

function ManageLink() {
  return (
    <Button
      size="sm"
      iconEnd={<ExternalLink />}
      render={<a href={MASTRA_PLATFORM_URL} target="_blank" rel="noreferrer" />}
    >
      Manage in Mastra Platform
    </Button>
  );
}

function ConnectionDescription({ connection }: { connection: ConnectToolConnection }) {
  const status = statusLabel(connection.status);
  if (!status) return connection.accountLabel ?? undefined;
  return (
    <Metadata>
      {connection.accountLabel && <Metadata.Item>{connection.accountLabel}</Metadata.Item>}
      <Metadata.Item className="text-destructive-foreground">{status}</Metadata.Item>
    </Metadata>
  );
}

function ProviderLogo({ connection }: { connection: ConnectToolConnection }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const { logoUrl, providerName } = connection;
  return (
    <SettingsItemIcon>
      {logoUrl && failedSrc !== logoUrl ? (
        <img src={logoUrl} alt="" className="size-4 shrink-0 object-contain" onError={() => setFailedSrc(logoUrl)} />
      ) : (
        <Txt as="span" variant="column" className="uppercase">
          {providerName.charAt(0)}
        </Txt>
      )}
    </SettingsItemIcon>
  );
}
