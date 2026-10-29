export const TOKEN_PLACEHOLDER = '<your-token>';

export interface ConnectSnippet {
  value: string;
  label: string;
  lang: string;
  code: string;
}

/** Copy-paste client configs for the built-in server. Never embeds a real credential, only a placeholder. */
export function buildConnectSnippets(url: string, { protectedServer }: { protectedServer: boolean }): ConnectSnippet[] {
  const authHeader = `Authorization: Bearer ${TOKEN_PLACEHOLDER}`;
  const headers = protectedServer ? { headers: { Authorization: `Bearer ${TOKEN_PLACEHOLDER}` } } : {};

  return [
    {
      value: 'claude-code',
      label: 'Claude Code',
      lang: 'bash',
      code: `claude mcp add --transport http mastra ${url}${protectedServer ? ` --header "${authHeader}"` : ''}`,
    },
    {
      value: 'cursor',
      label: 'Cursor',
      lang: 'json',
      code: JSON.stringify({ mcpServers: { mastra: { url, ...headers } } }, null, 2),
    },
    {
      value: 'vscode',
      label: 'VS Code',
      lang: 'json',
      code: JSON.stringify({ servers: { mastra: { type: 'http', url, ...headers } } }, null, 2),
    },
    {
      value: 'inspector',
      label: 'MCP Inspector',
      lang: 'bash',
      code: `npx @modelcontextprotocol/inspector --cli ${url} --transport http${protectedServer ? ` --header "${authHeader}"` : ''} --method tools/list`,
    },
  ];
}
