import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import type { VersionNegotiationMode } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { describe, expect, it } from 'vitest';

const stdioEntry = path.join(__dirname, '../../dist/stdio.js');

/**
 * Drives the built docs server the way an editor does: spawn `dist/stdio.js`,
 * open the connection with either handshake, then list tools and read a doc.
 */
async function connect(mode: VersionNegotiationMode) {
  const transport = new StdioClientTransport({ command: 'node', args: [stdioEntry], stderr: 'pipe' });
  const stderrChunks: string[] = [];
  transport.stderr!.on('data', chunk => stderrChunks.push(String(chunk)));

  const client = new Client({ name: 'era-test', version: '0.0.0' }, { versionNegotiation: mode });
  await client.connect(transport);

  const tools = await client.listTools();
  const prompts = await client.listPrompts();
  const doc = await client.callTool({ name: 'mastraDocs', arguments: { paths: ['docs/agents/overview'] } });
  await client.close();

  // The docs tool always leads with the requested path, whether or not the
  // `.docs` tree is being rebuilt by another test file at that moment.
  const docText = (doc.content as Array<{ type: string; text?: string }>)[0]?.text ?? '';

  const startup = stderrChunks
    .join('')
    .split('\n')
    .filter(line => line.startsWith('{'))
    .map(line => JSON.parse(line))
    .find(entry => entry.message === 'Started Mastra Docs MCP Server');

  return { tools, prompts, docText, startup };
}

describe('stdio protocol era routing', () => {
  it('serves a host that opens with the legacy initialize handshake', async () => {
    const { tools, prompts, docText, startup } = await connect({ mode: 'legacy' });

    expect(startup?.data).toEqual({ protocol: 'legacy' });
    expect(tools.tools.map(tool => tool.name)).toContain('mastraDocs');
    expect(prompts.prompts.map(prompt => prompt.name)).toEqual(['upgrade-to-v1', 'migration-checklist']);
    expect(docText.startsWith('## docs/agents/overview')).toBe(true);
  }, 30000);

  it('serves a host on the 2026-07-28 revision with the same tools', async () => {
    const { tools, prompts, docText, startup } = await connect({ mode: 'auto' });

    expect(startup?.data).toEqual({ protocol: '2026-07-28' });
    expect(tools.tools.map(tool => tool.name)).toContain('mastraDocs');
    expect(prompts.prompts.map(prompt => prompt.name)).toEqual(['upgrade-to-v1', 'migration-checklist']);
    expect(docText.startsWith('## docs/agents/overview')).toBe(true);
  }, 30000);
});
