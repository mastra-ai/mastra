import { describe, expect, it } from 'vitest';
import { listMcpServersResponseSchema, serverDetailSchema } from './mcp';

const versionDetail = {
  version: '1.0.0',
  release_date: '2026-09-03T00:00:00.000Z',
  is_latest: true,
};

describe('MCP registry response schemas', () => {
  it('preserves effective protocol metadata in list and detail responses', () => {
    const server = {
      id: 'modern-server',
      name: 'Modern MCP Server',
      version_detail: versionDetail,
      protocol_version: '2026-07-28' as const,
    };

    expect(
      listMcpServersResponseSchema.parse({ servers: [server], total_count: 1, next: null }).servers[0],
    ).toHaveProperty('protocol_version', '2026-07-28');
    expect(serverDetailSchema.parse(server)).toHaveProperty('protocol_version', '2026-07-28');
  });

  it('accepts responses from servers that do not report protocol metadata', () => {
    const server = { id: 'older-server', name: 'Older MCP Server', version_detail: versionDetail };

    expect(listMcpServersResponseSchema.safeParse({ servers: [server], total_count: 1, next: null }).success).toBe(
      true,
    );
    expect(serverDetailSchema.safeParse(server).success).toBe(true);
  });
});
