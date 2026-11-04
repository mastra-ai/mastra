import { CopyInput } from '@mastra/playground-ui/components/CopyInput';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { useParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { useServerFeatures } from '../../../../hooks/useServerFeatures';

import { SettingsSubsection } from './SettingsSubsection';

// Same-origin API: baseUrl is ''.
export function factoryMcpUrl(baseUrl: string, factoryId: string): string {
  return `${baseUrl || window.location.origin}/web/factory/projects/${encodeURIComponent(factoryId)}/mcp`;
}

function ConnectStep({ children }: { children: string }) {
  return (
    <Txt tone="muted" as="span" variant="caption">
      {children}
    </Txt>
  );
}

export function McpClientsSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const { baseUrl } = useApiConfig();
  const features = useServerFeatures();

  if (!factoryId || !features.data?.mcp) return null;
  const url = factoryMcpUrl(baseUrl, factoryId);

  return (
    <SettingsSubsection
      scope="personal"
      title="MCP clients"
      description="Use this Factory from Claude, ChatGPT and other MCP clients. They sign in as you."
    >
      <SettingsContainer>
        <SettingsRow label="MCP URL">
          <CopyInput value={url} label="MCP URL" />
        </SettingsRow>
        <SettingsRow label="Claude">
          <ConnectStep>Settings → Connectors → Add custom connector, paste the URL</ConnectStep>
        </SettingsRow>
        <SettingsRow label="ChatGPT">
          <ConnectStep>Plugins → + → Add custom MCP server, paste the URL, choose OAuth</ConnectStep>
        </SettingsRow>
      </SettingsContainer>
    </SettingsSubsection>
  );
}
