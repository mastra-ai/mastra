import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { describe, expect, it } from 'vitest';

const stdioEntry = path.join(__dirname, '../../dist/stdio.js');

async function runDocsCall(logLevel: string) {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [stdioEntry, '--log-level', logLevel],
    // Debug entries are additionally gated on DEBUG, so opt in for both runs.
    env: { ...process.env, DEBUG: '1' },
    stderr: 'pipe',
  });
  const stderrChunks: string[] = [];
  transport.stderr!.on('data', chunk => stderrChunks.push(String(chunk)));

  const client = new Client({ name: 'logging-test', version: '0.0.0' }, { versionNegotiation: { mode: 'auto' } });
  await client.connect(transport);
  const result = await client.callTool({ name: 'mastraDocs', arguments: { paths: ['docs/agents/overview'] } });
  await client.close();

  return { result, stderr: stderrChunks.join('') };
}

describe('stdio logging', () => {
  it('emits debug entries on stderr at --log-level debug and keeps stdout for JSON-RPC', async () => {
    const { result, stderr } = await runDocsCall('debug');

    // The tool call completed, so stdout carried a parseable JSON-RPC response.
    expect(result.content).toBeDefined();

    const entries = stderr
      .split('\n')
      .filter(line => line.startsWith('{'))
      .map(line => JSON.parse(line));
    expect(entries.some(entry => entry.level === 'debug' && entry.message === 'Reading docs content')).toBe(true);
  }, 30000);

  it('suppresses debug entries at --log-level error', async () => {
    const { result, stderr } = await runDocsCall('error');

    expect(result.content).toBeDefined();
    expect(stderr).not.toContain('Reading docs content');
  }, 30000);
});
