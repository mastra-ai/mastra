import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

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

describe('GithubIntegration capability surface', () => {
  it('normalizes GitHub issues through the shared Intake contract', async () => {
    const github = new GithubIntegration(validConfig());
    const listForRepo = vi.fn(async () => ({
      data: [
        {
          number: 12,
          title: 'Fix intake',
          html_url: 'https://github.com/acme/app/issues/12',
          user: { login: 'ada' },
          labels: [{ name: 'bug' }],
          comments: 3,
          created_at: '2026-07-01T00:00:00Z',
          updated_at: '2026-07-02T00:00:00Z',
        },
      ],
    }));
    vi.spyOn(github, 'getInstallationOctokit').mockReturnValue({ issues: { listForRepo } } as any);

    await expect(
      github.intake.listIssues({
        connection: { type: 'app-installation', installationId: 7 },
        sourceIds: ['acme/app'],
      }),
    ).resolves.toEqual({
      issues: [
        expect.objectContaining({
          id: '12',
          identifier: '#12',
          source: 'acme/app',
          state: 'open',
          labels: ['bug'],
          commentCount: 3,
        }),
      ],
      nextCursor: null,
    });
  });

  it('fetches issue details and creates comments through the shared Intake contract', async () => {
    const github = new GithubIntegration(validConfig());
    const get = vi.fn(async () => ({
      data: {
        number: 12,
        title: 'Fix intake',
        html_url: 'https://github.com/acme/app/issues/12',
        user: { login: 'ada' },
        state: 'open',
        assignee: null,
        labels: [{ name: 'bug' }],
        comments: 1,
        body: 'Issue body',
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-02T00:00:00Z',
      },
    }));
    const createComment = vi.fn(async () => ({
      data: { id: 99, html_url: 'https://github.com/acme/app/issues/12#issuecomment-99' },
    }));
    const paginate = vi.fn(async () => [
      { user: { login: 'grace' }, body: 'Looking now', created_at: '2026-07-03T00:00:00Z' },
    ]);
    vi.spyOn(github, 'getInstallationOctokit').mockReturnValue({
      issues: { get, listComments: vi.fn(), createComment },
      paginate,
    } as any);
    const connection = { type: 'app-installation' as const, installationId: 7 };

    await expect(github.intake.getIssue({ connection, sourceId: 'acme/app', issueId: '12' })).resolves.toMatchObject({
      description: 'Issue body',
      comments: [{ author: 'grace', body: 'Looking now' }],
    });
    await expect(
      github.intake.createComment({ connection, sourceId: 'acme/app', issueId: '12', body: 'Done' }),
    ).resolves.toEqual({ id: '99', url: 'https://github.com/acme/app/issues/12#issuecomment-99' });
  });

  it('normalizes pull requests through the shared VersionControl contract', async () => {
    const github = new GithubIntegration(validConfig());
    const list = vi.fn(async () => ({
      data: [
        {
          number: 34,
          title: 'Ship intake',
          html_url: 'https://github.com/acme/app/pull/34',
          user: { login: 'ada' },
          base: { ref: 'main' },
          head: { ref: 'feat/intake' },
          draft: false,
          created_at: '2026-07-01T00:00:00Z',
          updated_at: '2026-07-02T00:00:00Z',
        },
      ],
    }));
    vi.spyOn(github, 'getInstallationOctokit').mockReturnValue({ pulls: { list } } as any);

    await expect(
      github.versionControl.listPullRequests({
        connection: { type: 'app-installation', installationId: 7 },
        sourceId: 'acme/app',
      }),
    ).resolves.toEqual({
      pullRequests: [expect.objectContaining({ id: '34', baseBranch: 'main', headBranch: 'feat/intake' })],
      nextCursor: null,
    });
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
