import { describe, expect, it } from 'vitest';
import type { McpMetadata } from '../tools/types';
import { buildMcpServerGuidance, truncateMcpInstructions } from './mcp-guidance';

function tool(mcpMetadata?: McpMetadata) {
  return { mcpMetadata };
}

describe('truncateMcpInstructions', () => {
  it('returns instructions unchanged when under the limit', () => {
    expect(truncateMcpInstructions('hello', 512)).toBe('hello');
  });

  it('truncates to maxLength characters', () => {
    expect(truncateMcpInstructions('1234567890', 4)).toBe('1234');
  });

  it('defaults to 512 characters when maxLength is undefined', () => {
    const long = 'a'.repeat(600);
    expect(truncateMcpInstructions(long)).toHaveLength(512);
  });

  it('returns an empty string when maxLength is below 1', () => {
    expect(truncateMcpInstructions('hello', 0)).toBe('');
  });
});

describe('buildMcpServerGuidance', () => {
  it('returns undefined when there are no tools', () => {
    expect(buildMcpServerGuidance([])).toBeUndefined();
  });

  it('does not forward when forwardInstructions is omitted (opt-in)', () => {
    expect(buildMcpServerGuidance([tool({ serverName: 'db', serverInstructions: 'Validate first.' })])).toBeUndefined();
  });

  it('does not forward when forwardInstructions is false', () => {
    expect(
      buildMcpServerGuidance([
        tool({ serverName: 'db', serverInstructions: 'Validate first.', forwardInstructions: false }),
      ]),
    ).toBeUndefined();
  });

  it('forwards when forwardInstructions is true', () => {
    const guidance = buildMcpServerGuidance([
      tool({ serverName: 'db', serverInstructions: 'Validate first.', forwardInstructions: true }),
    ]);
    expect(guidance).toBe('## Guidance from MCP server "db"\n\nValidate first.');
  });

  it('skips blank instructions', () => {
    expect(
      buildMcpServerGuidance([tool({ serverName: 'db', serverInstructions: '   ', forwardInstructions: true })]),
    ).toBeUndefined();
  });

  it('dedupes multiple tools from the same server', () => {
    const guidance = buildMcpServerGuidance([
      tool({ serverName: 'db', serverInstructions: 'Validate first.', forwardInstructions: true }),
      tool({ serverName: 'db', serverInstructions: 'Validate first.', forwardInstructions: true }),
    ]);
    expect(guidance!.match(/Guidance from MCP server "db"/g)).toHaveLength(1);
  });

  it('orders servers deterministically by name', () => {
    const guidance = buildMcpServerGuidance([
      tool({ serverName: 'zeta', serverInstructions: 'Use zeta last.', forwardInstructions: true }),
      tool({ serverName: 'alpha', serverInstructions: 'Use alpha first.', forwardInstructions: true }),
    ]);
    expect(guidance!.indexOf('alpha')).toBeLessThan(guidance!.indexOf('zeta'));
  });

  it('truncates per-server using instructionsMaxLength', () => {
    const guidance = buildMcpServerGuidance([
      tool({
        serverName: 'long',
        serverInstructions: '1234567890',
        forwardInstructions: true,
        instructionsMaxLength: 4,
      }),
    ]);
    expect(guidance).toBe('## Guidance from MCP server "long"\n\n1234');
  });
});
