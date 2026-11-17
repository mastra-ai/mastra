import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ClampedText } from '@mastra/playground-ui/components/ClampedText';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
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
import { IconCodeBrackets } from '@mastra/playground-ui/icons/central/IconCodeBrackets';
import { IconSquareArrowTopRight } from '@mastra/playground-ui/icons/central/IconSquareArrowTopRight';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { useConnectToolListQuery, useConnectToolsQuery } from '../../../../hooks/useConnectTools';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import {
  connectToolsOffReason,
  groupConnectTools,
  platformProjectConnectUrl,
} from '../../factory/services/platformConnect';
import type {
  ConnectToolConnection,
  ConnectToolInfo,
  ConnectTools,
  ConnectToolsSetupMissing,
} from '../../factory/services/platformConnect';
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
            This Factory sets its session tools in code, with the <InlineCode>tools</InlineCode> option. These
            connections are used only if that code includes them, and it may narrow their tools.
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
          <SettingsEmptyRow action={<ManageLink projectId={query.data.projectId} />}>No connections</SettingsEmptyRow>
        </SettingsContainer>
      ) : (
        <ConnectionList connectTools={query.data} />
      )}
    </SettingsSubsection>
  );
}

function ConnectionList({ connectTools }: { connectTools: ConnectTools }) {
  const toolList = useConnectToolListQuery();
  const { connections, projectId } = connectTools;
  const groups = toolList.data
    ? groupConnectTools(
        toolList.data.tools,
        connections.map(connection => connection.integrationId),
      )
    : undefined;
  const status = toolList.isPending ? 'pending' : toolList.isError ? 'error' : 'success';

  return (
    <SettingsContainer>
      <SettingsListHeader action={<ManageLink projectId={projectId} />}>
        {connections.length === 1 ? '1 connection' : `${connections.length} connections`}
      </SettingsListHeader>
      {connections.map(connection => (
        <ToolsDisclosure
          key={connection.id}
          name={connection.providerName}
          media={<ProviderLogo connection={connection} />}
          description={<ConnectionDescription connection={connection} />}
          tools={groups?.byIntegration.get(connection.integrationId) ?? []}
          status={status}
        />
      ))}
      {groups && groups.other.length > 0 && (
        <ToolsDisclosure
          name={toolList.data?.toolsSource === 'custom' ? 'Other tools from code' : 'Other tools'}
          media={
            <SettingsItemIcon>
              <IconCodeBrackets />
            </SettingsItemIcon>
          }
          description="Not from a connection listed here"
          tools={groups.other}
          status={status}
        />
      )}
      {toolList.isError && (
        <RetryRow
          label="Tools"
          errorMsg={toolList.error instanceof Error ? toolList.error.message : "Couldn't list the tools."}
          onRetry={() => void toolList.refetch()}
        />
      )}
    </SettingsContainer>
  );
}

function toolCount(count: number): string {
  return count === 1 ? '1 tool' : `${count} tools`;
}

/** A connection (or the tools from no connection) with its tools behind a "N tools" toggle. */
function ToolsDisclosure({
  name,
  media,
  description,
  tools,
  status,
}: {
  name: string;
  media: ReactNode;
  description: ReactNode;
  tools: ConnectToolInfo[];
  status: 'pending' | 'error' | 'success';
}) {
  const offered = tools.filter(tool => !tool.excluded).length;
  return (
    <Collapsible>
      <SettingsItem media={media} title={name} description={description}>
        {status === 'pending' ? (
          <Txt as="span" variant="meta" tone="muted">
            Loading tools…
          </Txt>
        ) : status === 'error' ? null : tools.length === 0 ? (
          <Txt as="span" variant="meta" tone="muted">
            No tools
          </Txt>
        ) : (
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                iconEnd={<DisclosureChevron />}
                aria-label={`${name}: ${toolCount(offered)}`}
              >
                {toolCount(offered)}
              </Button>
            }
          />
        )}
      </SettingsItem>
      <CollapsibleContent className="flex gap-3 pt-3">
        <span aria-hidden className="w-avatar-md shrink-0" />
        <ToolList tools={tools} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolList({ tools }: { tools: ConnectToolInfo[] }) {
  // The tools sessions get first, then the ones Factory leaves out.
  const ordered = [...tools.filter(tool => !tool.excluded), ...tools.filter(tool => tool.excluded)];
  return (
    <ul className="flex min-w-0 flex-1 flex-col gap-3">
      {ordered.map(tool => (
        <li key={tool.name} className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Txt as="span" font="mono" variant="meta" className="min-w-0 break-all">
              {tool.name}
            </Txt>
            {tool.requiresApproval && (
              <Badge size="xs" variant="warning" emphasis="subtle">
                Needs approval
              </Badge>
            )}
            {tool.excluded && <Badge size="xs">Left out: deletes or archives</Badge>}
          </div>
          {tool.description && (
            <ClampedText variant="meta" tone="muted" lines={2}>
              {tool.description}
            </ClampedText>
          )}
        </li>
      ))}
    </ul>
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
      Manage in Platform
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
