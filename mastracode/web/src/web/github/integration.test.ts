import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { Octokit } from '@octokit/rest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStateSigner } from '../state-signing.js';
import { GithubIntegration, normalizePrivateKey } from './integration.js';

// Real RSA key so we can prove Node's PEM decoder accepts the normalized
// output (the failure mode is `error:1E08010C:DECODER routines::unsupported`).
const { privateKey: pem } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

function validConfig() {
  return {
    appId: '12345',
    privateKey: pem,
    clientId: 'Iv1.client',
    clientSecret: 'shhh',
    slug: 'test-app',
    webhookSecret: 'hook-secret',
  };
}

describe('normalizePrivateKey', () => {
  it('passes a proper multi-line PEM through unchanged', () => {
    expect(normalizePrivateKey(pem)).toBe(pem);
    expect(() => createPrivateKey(normalizePrivateKey(pem))).not.toThrow();
  });

  it('converts \\n-escaped single-line PEMs', () => {
    const escaped = pem.replace(/\n/g, '\\n');
    expect(() => createPrivateKey(normalizePrivateKey(escaped))).not.toThrow();
  });

  it('rebuilds fully flattened PEMs (newlines stripped by env tooling)', () => {
    const flattened = pem.replace(/\n/g, '');
    expect(flattened).not.toContain('\n');
    const normalized = normalizePrivateKey(flattened);
    expect(() => createPrivateKey(normalized)).not.toThrow();
  });

  it('leaves non-PEM values untouched', () => {
    expect(normalizePrivateKey('not-a-key')).toBe('not-a-key');
  });
});

describe('GithubIntegration constructor', () => {
  it('constructs from a full config', () => {
    const github = new GithubIntegration(validConfig());
    expect(github.id).toBe('github');
    expect(github.requiresStableStateSigner).toBe(true);
    expect(github.slug).toBe('test-app');
    expect(github.webhookSecret).toBe('hook-secret');
  });

  it('throws listing every missing required field', () => {
    expect(() => new GithubIntegration({ ...validConfig(), appId: '', slug: '' })).toThrow(/appId, slug/);
  });

  it('treats an empty webhook secret as unconfigured', () => {
    const github = new GithubIntegration({ ...validConfig(), webhookSecret: '' });
    expect(github.webhookSecret).toBeUndefined();
  });

  it('normalizes an \\n-escaped private key at construction', () => {
    const escaped = pem.replace(/\n/g, '\\n');
    expect(() => new GithubIntegration({ ...validConfig(), privateKey: escaped })).not.toThrow();
  });
});

describe('GithubIntegration FactoryIntegration surface', () => {
  it('routes() returns the GitHub HTTP surface as ApiRoute[]', () => {
    const github = new GithubIntegration(validConfig());
    const routes = github.routes({ stateSigner: createStateSigner('secret') });
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.path).toMatch(/^\/(web|auth)\/github\//);
    }
  });

  it('diagnostics() exposes only non-secret config', () => {
    const github = new GithubIntegration(validConfig());
    expect(github.diagnostics()).toEqual({ slug: 'test-app', webhookSecretConfigured: true });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockInstallationClient(github: GithubIntegration) {
  const octokit = new Octokit();
  vi.spyOn(github, 'getInstallationOctokit').mockReturnValue(octokit);
  return {
    issueGet: vi.spyOn(octokit.issues, 'get'),
    pullGet: vi.spyOn(octokit.pulls, 'get'),
  };
}

describe('GithubIntegration task detail reads', () => {
  it('maps and bounds issue fields through the scoped installation client', async () => {
    const github = new GithubIntegration(validConfig());
    const { issueGet } = mockInstallationClient(github);
    const labels = Array.from({ length: 55 }, (_, index) => ({ name: `label-${index}-${'x'.repeat(100)}` }));
    const assignees = Array.from({ length: 55 }, (_, index) => ({ login: `user-${index}-${'x'.repeat(100)}` }));
    issueGet.mockResolvedValue({
      data: {
        number: 42,
        title: 't'.repeat(600),
        body: 'd'.repeat(65_000),
        state: 'closed',
        labels,
        assignees,
        html_url: 'https://github.com/mastra-ai/mastra/issues/42',
      },
      headers: {},
      status: 200,
      url: 'https://api.github.com/repos/mastra-ai/mastra/issues/42',
    } as unknown as Awaited<ReturnType<typeof issueGet>>);

    const detail = await github.getIssueDetail(123, 'mastra-ai/mastra', 42);

    expect(issueGet).toHaveBeenCalledWith({ owner: 'mastra-ai', repo: 'mastra', issue_number: 42 });
    expect(detail).toEqual({
      number: 42,
      title: 't'.repeat(512),
      description: 'd'.repeat(64_000),
      state: 'closed',
      labels: labels.slice(0, 50).map(label => label.name.slice(0, 100)),
      assignees: assignees.slice(0, 50).map(assignee => assignee.login.slice(0, 100)),
      url: 'https://github.com/mastra-ai/mastra/issues/42',
    });
  });

  it('reports merged pull requests and omits unsafe or oversized URLs', async () => {
    const github = new GithubIntegration(validConfig());
    const { issueGet, pullGet } = mockInstallationClient(github);
    pullGet.mockResolvedValue({
      data: {
        number: 77,
        title: 'Ship task context',
        body: 'PR body',
        state: 'closed',
        merged: true,
        labels: [{ name: 'feature' }],
        assignees: [{ login: 'octocat' }],
        html_url: 'javascript:alert(1)',
      },
      headers: {},
      status: 200,
      url: 'https://api.github.com/repos/mastra-ai/mastra/pulls/77',
    } as unknown as Awaited<ReturnType<typeof pullGet>>);
    issueGet.mockResolvedValue({
      data: {
        number: 43,
        title: 'Oversized URL',
        body: null,
        state: 'open',
        labels: [],
        assignees: [],
        html_url: `https://github.com/${'x'.repeat(2_100)}`,
      },
      headers: {},
      status: 200,
      url: 'https://api.github.com/repos/mastra-ai/mastra/issues/43',
    } as unknown as Awaited<ReturnType<typeof issueGet>>);

    await expect(github.getPullRequestDetail(123, 'mastra-ai/mastra', 77)).resolves.toEqual({
      number: 77,
      title: 'Ship task context',
      description: 'PR body',
      state: 'merged',
      labels: ['feature'],
      assignees: ['octocat'],
    });
    await expect(github.getIssueDetail(123, 'mastra-ai/mastra', 43)).resolves.toEqual({
      number: 43,
      title: 'Oversized URL',
      state: 'open',
      labels: [],
      assignees: [],
    });
  });

  it('returns null only for not-found responses and propagates other failures', async () => {
    const github = new GithubIntegration(validConfig());
    const { issueGet, pullGet } = mockInstallationClient(github);
    issueGet.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    pullGet.mockRejectedValue(Object.assign(new Error('token leaked in upstream failure'), { status: 500 }));

    await expect(github.getIssueDetail(123, 'mastra-ai/mastra', 42)).resolves.toBeNull();
    await expect(github.getPullRequestDetail(123, 'mastra-ai/mastra', 77)).rejects.toThrow(
      'token leaked in upstream failure',
    );
  });
});
