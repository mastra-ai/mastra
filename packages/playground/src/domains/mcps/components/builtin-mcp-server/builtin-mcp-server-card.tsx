import type { GetBuiltinMcpServerResponse } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@mastra/playground-ui/components/Card';
import { CodeBlock } from '@mastra/playground-ui/components/CodeBlock';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { useMastraClient } from '@mastra/react';
import { ExternalLinkIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useBuiltinMcpServer } from '../../hooks/use-builtin-mcp-server';
import { buildConnectSnippets } from './snippets';

const DOCS_URL = 'https://mastra.ai/docs/server/mcp';

type Descriptor = GetBuiltinMcpServerResponse;
type EnabledDescriptor = Extract<Descriptor, { enabled: true }>;
type DisabledDescriptor = Extract<Descriptor, { enabled: false }>;

/**
 * The built-in server card. Hidden while loading, on 404 (servers that predate the descriptor route) and on
 * 401/403 (callers without `mcp:read`); any other failure shows an error in the card.
 */
export function BuiltinMcpServerSection() {
  const { data, error } = useBuiltinMcpServer();
  if (data) return <BuiltinMcpServerCard descriptor={data} />;
  if (!error || is401UnauthorizedError(error) || is403ForbiddenError(error) || is404NotFoundError(error)) return null;
  return (
    <BuiltinMcpServerFrame>
      <Notice variant="destructive">Couldn't load the built-in MCP server. Try reloading the page.</Notice>
    </BuiltinMcpServerFrame>
  );
}

export function BuiltinMcpServerCard({ descriptor }: { descriptor: Descriptor }) {
  return (
    <BuiltinMcpServerFrame status={<StatusBadge descriptor={descriptor} />}>
      {!descriptor.enabled ? (
        <DisabledContent descriptor={descriptor} />
      ) : !descriptor.mcpPackageInstalled ? (
        <MissingPackageContent />
      ) : (
        <EnabledContent descriptor={descriptor} />
      )}
    </BuiltinMcpServerFrame>
  );
}

function BuiltinMcpServerFrame({ status, children }: { status?: ReactNode; children: ReactNode }) {
  return (
    <Card role="region" aria-label="Mastra (built-in) MCP server">
      <CardHeader className="flex-row flex-wrap items-center gap-3 space-y-0 border-b border-border">
        <CardTitle className="shrink-0">Mastra (built-in)</CardTitle>
        {status}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

function StatusBadge({ descriptor }: { descriptor: Descriptor }) {
  const { label, variant } = statusOf(descriptor);
  return (
    <Badge variant={variant} emphasis="subtle" indicator="dot">
      {label}
    </Badge>
  );
}

function statusOf(descriptor: Descriptor): { label: string; variant: BadgeVariant } {
  if (!descriptor.enabled) return { label: 'Disabled', variant: 'neutral' };
  if (!descriptor.mcpPackageInstalled) return { label: 'Not installed', variant: 'warning' };
  const { auth } = descriptor;
  if (auth.type === 'protected') {
    return { label: `Protected by ${auth.provider ?? 'server auth'}`, variant: 'success' };
  }
  return auth.devOnly
    ? { label: 'Open in dev only', variant: 'info' }
    : { label: 'Open to anyone', variant: 'warning' };
}

function DisabledContent({ descriptor }: { descriptor: DisabledDescriptor }) {
  return (
    <>
      <Txt tone="muted">
        {descriptor.disabledReason === 'config' ? (
          <>
            The built-in MCP server is turned off because <InlineCode>server.mcp.enabled</InlineCode> is{' '}
            <InlineCode>false</InlineCode>.
          </>
        ) : (
          <>
            The built-in MCP server only runs under <InlineCode>mastra dev</InlineCode> unless the server has auth.
            Configure <InlineCode>server.auth</InlineCode>, or set <InlineCode>server.mcp.enabled</InlineCode> to{' '}
            <InlineCode>true</InlineCode>.
          </>
        )}
      </Txt>
      <DocsLink />
    </>
  );
}

function MissingPackageContent() {
  return (
    <>
      <Txt tone="muted">
        The built-in MCP server is enabled, but it needs the <InlineCode>@mastra/mcp</InlineCode> package. Install it
        and restart the server.
      </Txt>
      <CodeBlock code="npm install @mastra/mcp" lang="bash" copyTooltip="Copy install command" />
      <DocsLink />
    </>
  );
}

function EnabledContent({ descriptor }: { descriptor: EnabledDescriptor }) {
  const client = useMastraClient();
  const origin = client.options.baseUrl || window.location.origin;
  const url = `${origin}${descriptor.path}`;
  const snippets = buildConnectSnippets(url, { protectedServer: descriptor.auth.type === 'protected' });
  const [active, setActive] = useState(snippets[0].value);
  const activeSnippet = snippets.find(snippet => snippet.value === active) ?? snippets[0];

  return (
    <>
      <div className="flex flex-col gap-2">
        <Txt as="span" variant="label" tone="muted">
          Endpoint
        </Txt>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted py-2 pr-2 pl-3">
          <Txt as="span" font="mono" className="min-w-0 break-all">
            {url}
          </Txt>
          <CopyButton tooltip="Copy MCP endpoint URL" content={url} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Txt as="span" variant="label" tone="muted">
          Toolsets
        </Txt>
        <ul className="flex flex-wrap gap-2" aria-label="Toolsets">
          {descriptor.toolsets.map(toolset => (
            <li key={toolset}>
              <Badge variant="neutral" emphasis="subtle">
                {toolsetLabel(toolset)}
              </Badge>
            </li>
          ))}
          {descriptor.readOnly && (
            <li>
              <Badge variant="info" emphasis="subtle">
                Read-only
              </Badge>
            </li>
          )}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <Txt as="span" variant="label" tone="muted">
          Connect a client
        </Txt>
        <CodeBlock
          code={activeSnippet.code}
          lang={activeSnippet.lang}
          options={snippets.map(({ value, label }) => ({ value, label }))}
          value={active}
          onValueChange={setActive}
          selector="tabs"
          copyTooltip="Copy snippet"
        />
        <Txt variant="body-sm" tone="muted">
          Tools are listed per caller, so connect a client to see the tools your token can use.
        </Txt>
      </div>
    </>
  );
}

function toolsetLabel(toolset: string) {
  const words = toolset.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function DocsLink() {
  return (
    <div>
      <Button
        variant="ghost"
        render={<a href={DOCS_URL} target="_blank" rel="noopener noreferrer" />}
        icon={<ExternalLinkIcon />}
      >
        MCP server docs
      </Button>
    </div>
  );
}
