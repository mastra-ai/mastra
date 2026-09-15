import { describe, expect, it, vi } from 'vitest';

import { GitHubSourceControlProvider, createGitHubSourceControlProviderFromEnv } from './github';

describe('GitHubSourceControlProvider', () => {
  it('routes source control operations through the Platform broker', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-1' });

      if (url === 'https://api.mastra.ai/v1/server/source-storage/github/capabilities') {
        return jsonResponse({ canRead: true, canWrite: true, canListHistory: true, canOpenChangeRequest: true });
      }

      if (url.includes('/files?')) {
        expect(url).toContain('path=custom%2Fagents%2Fagent-1.json');
        return jsonResponse({ path: 'custom/agents/agent-1.json', ref: 'main', content: '{}', sha: 'file-sha' });
      }

      if (url.endsWith('/files')) {
        expect(JSON.parse(String(init?.body))).toMatchObject({ path: 'custom/agents/agent-1.json', content: '{}' });
        return jsonResponse({
          path: 'custom/agents/agent-1.json',
          ref: 'main',
          sha: 'new-file-sha',
          commitSha: 'commit-sha',
        });
      }

      if (url.includes('/files/list?')) {
        expect(url).toContain('path=custom%2Fagents');
        return jsonResponse([{ path: 'custom/agents/agent-1.json', sha: 'file-sha' }]);
      }

      if (url.includes('/files/history?')) {
        expect(url).toContain('path=custom%2Fagents%2Fagent-1.json');
        return jsonResponse([{ id: 'commit-sha', createdAt: '2026-06-01T00:00:00.000Z' }]);
      }

      if (url.endsWith('/change-requests')) {
        expect(JSON.parse(String(init?.body)).files[0]).toMatchObject({ path: 'custom/agents/agent-1.json' });
        return jsonResponse({ id: 12, url: 'https://github.com/acme/repo/pull/12', ref: 'mastra/agent-1' });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const provider = new GitHubSourceControlProvider({
      endpoint: 'https://api.mastra.ai/v1/',
      token: 'token-1',
      pathPrefix: 'custom',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(provider.getCapabilities()).resolves.toMatchObject({ canWrite: true });
    await expect(provider.readFile({ path: 'agents/agent-1.json' })).resolves.toMatchObject({
      path: 'agents/agent-1.json',
      sha: 'file-sha',
    });
    await expect(provider.writeFile({ path: 'agents/agent-1.json', content: '{}' })).resolves.toMatchObject({
      path: 'agents/agent-1.json',
      commitSha: 'commit-sha',
    });
    await expect(provider.listFileHistory({ path: 'agents/agent-1.json' })).resolves.toHaveLength(1);
    await expect(provider.listFiles({ path: 'agents' })).resolves.toEqual([
      { path: 'agents/agent-1.json', sha: 'file-sha' },
    ]);
    await expect(
      provider.openChangeRequest({
        title: 'Update agent',
        files: [{ path: 'agents/agent-1.json', content: '{}' }],
      }),
    ).resolves.toMatchObject({ id: 12 });
  });

  it('creates a provider from hosted source control environment variables', () => {
    const provider = createGitHubSourceControlProviderFromEnv({
      MASTRA_SOURCE_PROVIDER: 'github',
      MASTRA_SHARED_API_URL: 'https://api.mastra.ai/v1',
      MASTRA_PLATFORM_ACCESS_TOKEN: 'token-1',
    });

    expect(provider).toBeInstanceOf(GitHubSourceControlProvider);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
