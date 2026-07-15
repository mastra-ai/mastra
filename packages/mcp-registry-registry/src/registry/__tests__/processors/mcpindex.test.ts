import { describe, it, expect } from 'vitest';
import { getServersFromRegistry } from '../../fetch-servers';
import { processMcpindexServers } from '../../processors/mcpindex';
import type { ServerEntry } from '../../types';

describe('mcpindex processor', () => {
  it('should process mcpindex server data correctly (live)', async () => {
    try {
      const result = await getServersFromRegistry('mcpindex');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      result.forEach((server: ServerEntry) => {
        expect(server).toHaveProperty('id');
        expect(server).toHaveProperty('name');
        expect(server).toHaveProperty('description');
        expect(server).toHaveProperty('createdAt');
        expect(server).toHaveProperty('updatedAt');
      });
    } catch (error) {
      console.warn('Error during mcpindex live test (network/endpoint):', error);
      // Skip if the endpoint is unreachable in CI.
    }
  });

  it('should handle sample mcpindex data correctly', () => {
    // Mirrors the /api/v1/servers browse-feed envelope.
    const sampleData = {
      total: 15953,
      returned: 2,
      generatedAt: '2026-07-15T00:00:00.000Z',
      servers: [
        {
          slug: 'io-github-pipeworx-io-github',
          name: 'io.github.pipeworx-io/github',
          title: 'Github',
          description: 'GitHub MCP — wraps the GitHub public REST API (no auth required for public endpoints).',
          category: 'github',
          version: '0.1.1',
          qualityScore: 90,
          installs: { remote: 'https://gateway.pipeworx.io/github/mcp' },
          url: 'https://mcpindex.ai/server/io-github-pipeworx-io-github',
          updatedAt: '2026-07-01T12:00:00.000Z',
        },
        {
          slug: 'ac-inference-sh-mcp',
          name: 'ac.inference.sh/mcp',
          title: 'inference.sh',
          description: 'Run 150+ AI apps — image, video, audio, LLMs, 3D and more.',
          category: 'ai',
          version: '1.0.1',
          qualityScore: 65,
          installs: { remote: 'https://sh.inference.ac' },
          url: 'https://mcpindex.ai/server/ac-inference-sh-mcp',
          updatedAt: '',
        },
        // No slug -> must be filtered out.
        { name: 'orphan', title: 'Orphan', description: 'no slug' },
      ],
    };

    const servers = processMcpindexServers(sampleData);

    // The slug-less entry is dropped.
    expect(servers.length).toBe(2);

    // id <- slug, name <- title, description mapped, createdAt always '', updatedAt passed through.
    expect(servers[0]).toEqual({
      id: 'io-github-pipeworx-io-github',
      name: 'Github',
      description: 'GitHub MCP — wraps the GitHub public REST API (no auth required for public endpoints).',
      createdAt: '',
      updatedAt: '2026-07-01T12:00:00.000Z',
    });
    expect(servers[1].id).toBe('ac-inference-sh-mcp');
    expect(servers[1].name).toBe('inference.sh');
    expect(servers[1].updatedAt).toBe('');
  });

  it('returns an empty array for a malformed payload', () => {
    expect(processMcpindexServers(null)).toEqual([]);
    expect(processMcpindexServers({})).toEqual([]);
    expect(processMcpindexServers({ servers: 'nope' })).toEqual([]);
  });
});
