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
import { IconSquareArrowTopRight } from '@mastra/playground-ui/icons/central/IconSquareArrowTopRight';
import { useState } from 'react';

import { useConnectToolsQuery } from '../../../../hooks/useConnectTools';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { connectToolsOffReason, platformProjectConnectUrl } from '../../factory/services/platformConnect';
import type { ConnectToolConnection, ConnectToolsSetupMissing } from '../../factory/services/platformConnect';
import { SettingsSubsection } from './SettingsSubsection';
import { RetryRow } from './common/ConnectionStateRows';

const SECTION_LABEL = 'Mastra Connect';

const DEFAULT_DESCRIPTION =
  "Sessions can use the Mastra Connect tools of every connection attached to this Factory's Platform project. They run without asking for approval. Tools named for deleting or archiving, and GitHub and GitLab tools, are left out.";
const CUSTOM_DESCRIPTION =
  "The connections attached to this Factory's Platform project. This Factory's tools option decides which of their Mastra Connect tools sessions get.";

export function ConnectToolsSection() {
  const query = useConnectToolsQuery();
  const offReason = query.isError ? connectToolsOffReason(query.error) : undefined;
  const custom = query.data?.toolsSource === 'custom';

  return (
    <SettingsSubsection
      scope="deployment"
      title="Mastra Connect tools"
      description={custom ? CUSTOM_DESCRIPTION : DEFAULT_DESCRIPTION}
    >
      {custom && (
        <Notice variant="info">
          <Notice.Message>
            This Factory sets its session tools in code (<InlineCode>tools</InlineCode> option). These connections are
            used only if that code includes them, and it may narrow their tools.
          </Notice.Message>
        </Notice>
      )}
      {query.isPending ? (
        <SettingsContainer>
          <SettingsSkeleton variant="item" label="Loading Mastra Connect tools" />
        </SettingsContainer>
      ) : offReason ? (
        <Notice variant="info">
          <Notice.Message>
            <ConnectToolsOffMessage reason={offReason} />
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
      ) : query.data.connections.length === 0 ? (
        <SettingsContainer>
          <SettingsEmptyRow action={<ManageLink projectId={query.data.projectId} />}>
            No connections are attached to this Factory's project yet.
          </SettingsEmptyRow>
        </SettingsContainer>
      ) : (
        <SettingsContainer>
          <SettingsListHeader action={<ManageLink projectId={query.data.projectId} />}>
            {query.data.connections.length === 1 ? '1 connection' : `${query.data.connections.length} connections`}
          </SettingsListHeader>
          {query.data.connections.map(connection => (
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

function ConnectToolsOffMessage({ reason }: { reason: ConnectToolsSetupMissing | 'unknown' }) {
  if (reason === 'no_credentials') {
    return (
      <>
        Mastra Connect tools are off: this Factory has no Mastra Platform credentials. Set{' '}
        <InlineCode>MASTRA_PLATFORM_SECRET_KEY</InlineCode> or <InlineCode>MASTRA_PLATFORM_ACCESS_TOKEN</InlineCode>.
      </>
    );
  }
  if (reason === 'no_project_id') {
    return (
      <>
        Mastra Connect tools are off: this Factory has Platform credentials but no{' '}
        <InlineCode>MASTRA_PROJECT_ID</InlineCode>.
      </>
    );
  }
  // Servers that predate the reason also answered "off" for a custom `tools` option.
  return (
    <>
      Mastra Connect tools are off: this Factory sets a custom <InlineCode>tools</InlineCode> option or is missing
      Platform credentials or <InlineCode>MASTRA_PROJECT_ID</InlineCode>.
    </>
  );
}

function statusLabel(status: string): string | undefined {
  if (status === 'active') return undefined;
  if (status === 'needs_reauth') return 'Needs reconnecting';
  return 'Unavailable';
}

function ManageLink({ projectId }: { projectId: string }) {
  const auth = useFactoryAuth();
  const href = platformProjectConnectUrl(projectId, auth.data?.user?.organizationId);
  return (
    <Button size="sm" iconEnd={<IconSquareArrowTopRight />} render={<a href={href} target="_blank" rel="noreferrer" />}>
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
