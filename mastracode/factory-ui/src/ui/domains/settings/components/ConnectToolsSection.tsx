import { Button } from '@mastra/playground-ui/components/Button';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';

import { useConnectToolsQuery } from '../../../../hooks/useConnectTools';
import { SettingsRowsSkeleton } from '../../../ui/SettingsRowsSkeleton';
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
      action={!unavailable && <ManageLink />}
    >
      {query.isPending ? (
        <SettingsContainer>
          <SettingsRowsSkeleton label="Loading Mastra Connect tools" />
        </SettingsContainer>
      ) : unavailable ? (
        <SettingsContainer>
          <SettingsRow
            label={SECTION_LABEL}
            description={
              <>
                Sessions on this Factory don't get Mastra Connect tools. They need Platform credentials and{' '}
                <InlineCode>MASTRA_PROJECT_ID</InlineCode>, and no custom <InlineCode>tools</InlineCode> option.
              </>
            }
          />
        </SettingsContainer>
      ) : query.isError ? (
        <SettingsContainer>
          <RetryRow
            label={SECTION_LABEL}
            errorMsg="Couldn't load Mastra Connect tools."
            onRetry={() => void query.refetch()}
          />
        </SettingsContainer>
      ) : query.data.length === 0 ? (
        <Txt as="p" variant="caption" tone="muted">
          No connections are attached to this Factory's project yet. Attach one in Mastra Platform, on your project's
          Connect page.
        </Txt>
      ) : (
        <SettingsContainer>
          {query.data.map(connection => (
            <SettingsRow
              key={connection.id}
              label={<ProviderLabel connection={connection} />}
              description={connection.accountLabel ?? undefined}
              errorMsg={statusLabel(connection.status)}
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

function ProviderLabel({ connection }: { connection: ConnectToolConnection }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const { logoUrl, providerName } = connection;
  return (
    <span className="flex items-center gap-2">
      {logoUrl && failedSrc !== logoUrl ? (
        <img src={logoUrl} alt="" className="size-4 shrink-0 object-contain" onError={() => setFailedSrc(logoUrl)} />
      ) : (
        <span
          aria-hidden
          className="bg-muted text-muted-foreground flex size-4 shrink-0 items-center justify-center rounded-sm text-[10px] font-medium uppercase"
        >
          {providerName.charAt(0)}
        </span>
      )}
      {providerName}
    </span>
  );
}
