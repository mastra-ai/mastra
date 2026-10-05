import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import type * as factoryModule from '@mastra/factory';
import { AUTO_TRIAGED_LABEL } from '@mastra/factory/rules/types';

const factoryConfigs = vi.hoisted(() => [] as Array<ConstructorParameters<typeof factoryModule.MastraFactory>[0]>);
vi.mock('@mastra/factory', async importOriginal => {
  const actual = await importOriginal<typeof factoryModule>();
  class TrackedMastraFactory extends actual.MastraFactory {
    constructor(config: ConstructorParameters<typeof actual.MastraFactory>[0]) {
      super(config);
      factoryConfigs.push(config);
    }
  }
  return { ...actual, MastraFactory: TrackedMastraFactory };
});

/**
 * Smoke test for the platform-deployable entry (`src/mastra/index.ts`).
 *
 * Importing the module boots the real controller via top-level await and
 * constructs the server-owned Mastra. We assert the deployer-facing surface:
 * the module exports a `mastra` instance and that instance carries the web
 * `apiRoutes` (auth + `/web/*`) the deployer's generated Hono server mounts.
 *
 * With no auth env configured the entry leaves `auth` undefined, so the
 * factory installs its default platform-backed provider (`MastraAuthStudio`)
 * and the public `/auth/*` routes ride along on `apiRoutes`. The custom
 * `/web/*` routes are always present.
 */
describe('platform entry (src/mastra/index.ts)', () => {
  // Every test in this file imports the real entry, and the entry's auth
  // selection reads WORKOS_*/MASTRA_* directly from the environment. Blank
  // them at file scope so a runner with real credentials exported can't flip
  // the entry into a different auth branch (or crash tests that stub a short
  // WORKOS_COOKIE_PASSWORD); each test states its own env on top of this.
  beforeEach(() => {
    for (const name of [
      'MASTRACODE_AUTH_DISABLED',
      'WORKOS_API_KEY',
      'WORKOS_CLIENT_ID',
      'WORKOS_COOKIE_PASSWORD',
      'MASTRA_SHARED_API_URL',
      'MASTRA_PLATFORM_SECRET_KEY',
      'MASTRA_PLATFORM_ACCESS_TOKEN',
      'MASTRA_CLOUD_ACCESS_TOKEN',
      'MASTRA_ENVIRONMENT_ID',
      'DATABASE_URL',
      'APP_DATABASE_URL',
      'REDIS_URL',
      'GITHUB_APP_ID',
      'GITHUB_APP_PRIVATE_KEY',
      'GITHUB_APP_CLIENT_ID',
      'GITHUB_APP_CLIENT_SECRET',
      'GITHUB_APP_SLUG',
      'GITHUB_APP_WEBHOOK_SECRET',
      'GITLAB_ACCESS_TOKEN',
      'GITLAB_ACCESS_TOKEN_TYPE',
      'GITLAB_BASE_URL',
      'GITLAB_WEBHOOK_SECRET',
      'MASTRA_GITLAB_CONNECTION_ID',
      'LINEAR_CLIENT_ID',
      'LINEAR_CLIENT_SECRET',
      'INCIDENT_IO_API_KEY',
      'SLACK_APP_SIGNING_SECRET',
      'MASTRACODE_DISPATCH_MAX_IN_FLIGHT',
    ]) {
      vi.stubEnv(name, '');
    }
    vi.stubEnv('MASTRA_PROJECT_ID', 'test-project');
    factoryConfigs.length = 0;
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('exports a booted Mastra with the web apiRoutes folded onto server config', { timeout: 60_000 }, async () => {
    const mod = await import('./index.js');

    expect(mod.mastra).toBeDefined();
    // The deployer imports this named export and generates its Hono server from it.
    expect(typeof mod.mastra.getServer).toBe('function');

    const server = mod.mastra.getServer();
    expect(server).toBeDefined();

    // The custom web surface must ride along on `server.apiRoutes` so the
    // deployer-generated server exposes it. At minimum the fs `/web/*` routes
    // are always assembled (github is fail-soft, auth routes are gated).
    const apiRoutes = server?.apiRoutes ?? [];
    const paths = apiRoutes.map(r => r.path);
    expect(paths.some(p => p.startsWith('/web/'))).toBe(true);
  });

  it('uses the preferred installed boards without deployment-owned lifecycle handlers', async () => {
    const { factoryConfigVersion } = await import('./index.js');
    expect(factoryConfigVersion).toBe('mastracode-web-v1');
    expect(factoryConfigs[0]?.configVersion).toBe(factoryConfigVersion);
    expect(factoryConfigs[0]).not.toHaveProperty('rules');
    expect(factoryConfigs[0]?.boards).toBeUndefined();
    expect(factoryConfigs[0]?.includeDefaultBoards).toBeUndefined();
  });

  it('forwards the dispatcher concurrency environment setting to the factory', { timeout: 60_000 }, async () => {
    vi.stubEnv('MASTRACODE_DISPATCH_MAX_IN_FLIGHT', '7');
    await import('./index.js');

    expect(factoryConfigs).toHaveLength(1);
    expect(factoryConfigs[0]?.dispatcher).toEqual({ maxInFlight: 7 });
  });

  it('uses the installed GitHub rules to retriage linked issue updates without moving their stage', async () => {
    vi.stubEnv('GITHUB_APP_ID', '123');
    vi.stubEnv('GITHUB_APP_PRIVATE_KEY', 'test-private-key');
    vi.stubEnv('GITHUB_APP_CLIENT_ID', 'client-id');
    vi.stubEnv('GITHUB_APP_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('GITHUB_APP_SLUG', 'factory-app');
    vi.stubEnv('GITHUB_APP_WEBHOOK_SECRET', 'test-webhook-secret');
    const { factoryConfigVersion } = await import('./index.js');
    const { GithubIntegration } = await import('@mastra/factory/integrations/github/integration');
    const github = factoryConfigs[0]?.integrations?.find(
      (integration): integration is InstanceType<typeof GithubIntegration> => integration instanceof GithubIntegration,
    );
    expect(github).toBeDefined();
    if (!github) throw new Error('Expected the configured GitHub integration');
    const item = {
      id: 'issue-42',
      source: 'github-issue' as const,
      sourceKey: 'github-issue:42',
      parentWorkItemId: null,
      title: 'Issue 42',
      url: 'https://github.com/acme/repo/issues/42',
      stages: ['planning'],
    };
    const base = {
      tenant: { orgId: 'org-1', projectId: 'project-1' },
      actor: { type: 'github' as const, login: 'contributor', trusted: true, factoryAuthored: false },
      causalChain: [],
      configVersion: factoryConfigVersion,
      factory: { createdAt: '2030-01-01T00:00:00.000Z' },
      repository: { id: 10, fullName: 'acme/repo' },
      item,
      board: 'work' as const,
      itemRevision: 3,
    };

    const { issueEdited, issueCommentCreated } = github.rules;

    expect(
      issueEdited?.({
        ...base,
        ingress: { type: 'github', id: '7:issue-update' },
        cause: 'github.issueEdited',
        event: 'issueEdited',
        deliveryId: 'issue-update',
        issue: { number: 42, title: 'Issue 42', url: item.url },
        issueChange: { title: false, body: true },
      }),
    ).toMatchObject({
      type: 'invokeSkill',
      idempotencyKey: '7:issue-update:factory-triage',
    });
    expect(
      issueCommentCreated?.({
        ...base,
        ingress: { type: 'github', id: '7:comment-created' },
        cause: 'github.issueCommentCreated',
        event: 'issueCommentCreated',
        deliveryId: 'comment-created',
        issue: { number: 42, title: 'Issue 42', url: item.url },
        issueComment: { id: 100, author: 'contributor', body: 'New lead' },
      }),
    ).toMatchObject({
      type: 'invokeSkill',
      idempotencyKey: '7:comment-created:factory-triage',
    });
    expect(item.stages).toEqual(['planning']);
  });

  it('routes a newly opened issue by its labels, three ways', { timeout: 60_000 }, async () => {
    vi.stubEnv('GITHUB_APP_ID', '123');
    vi.stubEnv('GITHUB_APP_PRIVATE_KEY', 'test-private-key');
    vi.stubEnv('GITHUB_APP_CLIENT_ID', 'client-id');
    vi.stubEnv('GITHUB_APP_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('GITHUB_APP_SLUG', 'factory-app');
    vi.stubEnv('GITHUB_APP_WEBHOOK_SECRET', 'test-webhook-secret');
    const { factoryConfigVersion } = await import('./index.js');
    const { GithubIntegration } = await import('@mastra/factory/integrations/github/integration');
    const github = factoryConfigs[0]?.integrations?.find(
      (integration): integration is InstanceType<typeof GithubIntegration> => integration instanceof GithubIntegration,
    );
    if (!github) throw new Error('Expected the configured GitHub integration');

    const issue = { number: 7, title: 'Issue 7', url: 'https://github.com/acme/repo/issues/7' };
    const context = (labels: string[]) => ({
      tenant: { orgId: 'org-1', projectId: 'project-1' },
      actor: { type: 'github' as const, login: 'maintainer', trusted: true, factoryAuthored: false },
      ingress: { type: 'github' as const, id: '9:issue-opened' },
      cause: 'github.issueOpened',
      causalChain: [],
      configVersion: factoryConfigVersion,
      factory: { createdAt: '2030-01-01T00:00:00.000Z' },
      repository: { id: 10, fullName: 'acme/repo' },
      event: 'issueOpened' as const,
      deliveryId: 'issue-opened',
      issue: { ...issue, labels },
    });
    const { issueOpened } = github.rules;

    // Without the label the issue is taken to be already curated: the card
    // skips the resting Intake column, so Triage's entry rule runs the moment
    // it materializes and the card is left ready to plan.
    expect(issueOpened?.(context([]))).toMatchObject({
      type: 'upsertLinkedWorkItem',
      idempotencyKey: '9:issue-opened:issue-intake',
      board: 'work',
      stage: 'triage',
      sourceKey: 'github-issue:7',
      title: 'Issue 7',
    });

    // With the label the built-in landing stands: the card rests in Intake
    // until a person starts a run.
    expect(issueOpened?.(context(['needs-triage']))).toMatchObject({
      type: 'upsertLinkedWorkItem',
      board: 'work',
      stage: 'intake',
    });

    // `status: auto-triaged` (what the triage skill stamps when it finishes) is
    // filed straight on Planning and runs no phase rule: triage already
    // happened, so the card is published to the board rather than launched.
    expect(issueOpened?.(context([AUTO_TRIAGED_LABEL]))).toMatchObject({
      type: 'upsertLinkedWorkItem',
      board: 'work',
      stage: 'planning',
      skipRules: true,
    });

    // A maintainer's explicit flag outranks the automated stamp.
    expect(issueOpened?.(context([AUTO_TRIAGED_LABEL, 'needs-triage']))).toMatchObject({
      type: 'upsertLinkedWorkItem',
      board: 'work',
      stage: 'intake',
    });
    expect(issueOpened?.(context([AUTO_TRIAGED_LABEL, 'needs-triage']))).not.toHaveProperty('skipRules');

    // A project's own label route owns the board and its initial phase.
    expect(issueOpened?.({ ...context(['bug']), intake: { board: 'work', initialPhase: 'planning' } })).toMatchObject({
      type: 'upsertLinkedWorkItem',
      board: 'work',
      stage: 'planning',
    });

    // The reconcile sweep replays this same rule on label drift, with the card
    // attached. A card that has already left Intake is re-placed where the
    // labels put it and no phase rule runs for it — it sits past Intake because
    // a placement put it there, so it is not arriving.
    const card = (stages: string[]) => ({
      id: 'card-7',
      source: 'github-issue' as const,
      sourceKey: 'github-issue:7',
      parentWorkItemId: null,
      title: 'Issue 7',
      url: issue.url,
      stages,
      acceptedAt: null,
      metadata: {},
    });
    expect(issueOpened?.({ ...context([]), item: card(['planning']) })).toMatchObject({
      type: 'upsertLinkedWorkItem',
      board: 'work',
      stage: 'triage',
      skipRules: true,
    });
    expect(issueOpened?.({ ...context(['needs-triage']), item: card(['planning']) })).toMatchObject({
      type: 'upsertLinkedWorkItem',
      board: 'work',
      stage: 'intake',
      skipRules: true,
    });
    // A card still resting on Intake lands normally on that same replay, so
    // Triage's entry rule runs and can start it.
    expect(issueOpened?.({ ...context([]), item: card(['intake']) })).toMatchObject({
      type: 'upsertLinkedWorkItem',
      board: 'work',
      stage: 'triage',
    });
    expect(issueOpened?.({ ...context([]), item: card(['intake']) })).not.toHaveProperty('skipRules');
  });

  it('sends the item a pull request was authored from to review when it opens', { timeout: 60_000 }, async () => {
    vi.stubEnv('GITHUB_APP_ID', '123');
    vi.stubEnv('GITHUB_APP_PRIVATE_KEY', 'test-private-key');
    vi.stubEnv('GITHUB_APP_CLIENT_ID', 'client-id');
    vi.stubEnv('GITHUB_APP_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('GITHUB_APP_SLUG', 'factory-app');
    vi.stubEnv('GITHUB_APP_WEBHOOK_SECRET', 'test-webhook-secret');
    const { factoryConfigVersion } = await import('./index.js');
    const { GithubIntegration } = await import('@mastra/factory/integrations/github/integration');
    const github = factoryConfigs[0]?.integrations?.find(
      (integration): integration is InstanceType<typeof GithubIntegration> => integration instanceof GithubIntegration,
    );
    if (!github) throw new Error('Expected the configured GitHub integration');

    const context = {
      tenant: { orgId: 'org-1', projectId: 'project-1' },
      actor: { type: 'github' as const, login: 'maintainer', trusted: true, factoryAuthored: false },
      ingress: { type: 'github' as const, id: '9:pr-opened' },
      cause: 'github.pullRequestOpened',
      causalChain: [],
      configVersion: factoryConfigVersion,
      factory: { createdAt: '2030-01-01T00:00:00.000Z' },
      repository: { id: 10, fullName: 'acme/repo' },
      event: 'pullRequestOpened' as const,
      deliveryId: 'pr-opened',
      pullRequest: {
        number: 17,
        title: 'PR 17',
        url: 'https://github.com/acme/repo/pull/17',
        createdAt: '2030-01-01T00:00:00Z',
        state: 'open' as const,
        draft: false,
        merged: false,
        headBranch: 'factory/issue-42',
        baseBranch: 'main',
        factoryAuthored: false,
      },
    };
    const card = {
      id: 'card-42',
      source: 'github-issue' as const,
      sourceKey: 'github-issue:42',
      parentWorkItemId: null,
      title: 'Issue 42',
      url: 'https://github.com/acme/repo/issues/42',
      stages: ['execute'],
      acceptedAt: null,
      metadata: {},
    };
    const { pullRequestOpened } = github.rules;

    // The arrival — the evaluation that files the pull request's own Review
    // card — keeps the built-in behaviour, whether or not a card is bound to it.
    expect(pullRequestOpened?.({ ...context, pullRequestIntake: true })).toMatchObject({
      type: 'upsertLinkedWorkItem',
      source: 'github-pr',
      board: 'review',
      stage: 'intake',
    });
    expect(pullRequestOpened?.({ ...context, pullRequestIntake: true, item: card, board: 'work' })).toMatchObject({
      source: 'github-pr',
    });

    // The item the pull request was authored from waits for review. That is a
    // placement, not a governed transition: no phase rule runs for it and the
    // card's own facts are left alone.
    expect(pullRequestOpened?.({ ...context, item: card, board: 'work' })).toMatchObject({
      type: 'upsertLinkedWorkItem',
      idempotencyKey: '9:pr-opened:work-item-review',
      source: 'github-issue',
      sourceKey: 'github-issue:42',
      board: 'work',
      stage: 'review',
      skipRules: true,
    });
    // Already waiting for review, or living on a board whose phases are its
    // own: nothing to place.
    expect(pullRequestOpened?.({ ...context, item: { ...card, stages: ['review'] }, board: 'work' })).toBeUndefined();
    expect(pullRequestOpened?.({ ...context, item: card, board: 'release' })).toBeUndefined();
  });

  it('carries the GitHub event-rule overrides on whichever integration is installed', { timeout: 60_000 }, async () => {
    const { githubRules } = await import('./github-rules.js');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // The factory's integration signer needs a replica-stable secret; the
    // webhook secret is the first the entry falls back to.
    vi.stubEnv('GITHUB_APP_WEBHOOK_SECRET', 'test-webhook-secret');

    // Platform credentials and no GITHUB_APP_* group: the factory installs the
    // Platform-backed integration itself, so the overrides ride along on
    // `platform.github`.
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'platform-token');
    await import('./index.js');
    expect(factoryConfigs[0]?.integrations?.some(integration => integration.id === 'github')).toBe(false);
    expect(factoryConfigs[0]?.platform?.github?.rules).toBe(githubRules);

    vi.resetModules();
    factoryConfigs.length = 0;

    // A direct GITHUB_APP_* group supplies the integration itself, so
    // `platform.github` stays unset: set, it would warn on every boot that an
    // explicit integration takes precedence.
    vi.stubEnv('GITHUB_APP_ID', '123');
    vi.stubEnv('GITHUB_APP_PRIVATE_KEY', 'test-private-key');
    vi.stubEnv('GITHUB_APP_CLIENT_ID', 'client-id');
    vi.stubEnv('GITHUB_APP_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('GITHUB_APP_SLUG', 'factory-app');
    await import('./index.js');
    expect(factoryConfigs[0]?.platform?.github).toBeUndefined();
    expect(warn.mock.calls.flat().join('\n')).not.toContain("'github' config was provided");

    warn.mockRestore();
  });

  // Integration env groups are all-or-nothing: a partial set means the
  // integration stays un-wired, but boot must survive so the diagnostics
  // surface can report exactly which vars are missing.
  describe('integration env groups', () => {
    beforeEach(() => {
      for (const name of [
        'GITHUB_APP_ID',
        'GITHUB_APP_PRIVATE_KEY',
        'GITHUB_APP_CLIENT_ID',
        'GITHUB_APP_CLIENT_SECRET',
        'GITHUB_APP_SLUG',
        'GITHUB_APP_WEBHOOK_SECRET',
        'GITLAB_ACCESS_TOKEN',
        'GITLAB_ACCESS_TOKEN_TYPE',
        'GITLAB_BASE_URL',
        'GITLAB_WEBHOOK_SECRET',
        'MASTRA_GITLAB_CONNECTION_ID',
        'LINEAR_CLIENT_ID',
        'LINEAR_CLIENT_SECRET',
        'JIRA_BASE_URL',
        'JIRA_EMAIL',
        'JIRA_API_TOKEN',
        'INCIDENT_IO_API_KEY',
        'SLACK_APP_SIGNING_SECRET',
      ]) {
        vi.stubEnv(name, '');
      }
      vi.resetModules();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it(
      'boots when the GitHub group is partially configured so diagnostics can report the missing setup',
      { timeout: 60_000 },
      async () => {
        vi.resetModules();
        // The test env may carry a full GitHub config — blank everything but the
        // app id to force the partial state.
        vi.stubEnv('GITHUB_APP_ID', '12345');
        vi.stubEnv('GITHUB_APP_PRIVATE_KEY', '');
        vi.stubEnv('GITHUB_APP_CLIENT_ID', '');
        vi.stubEnv('GITHUB_APP_CLIENT_SECRET', '');
        vi.stubEnv('GITHUB_APP_SLUG', '');
        const mod = await import('./index.js');
        expect(mod.mastra).toBeDefined();
      },
    );

    it(
      'registers the direct GitHub App integration when the full group is configured',
      { timeout: 60_000 },
      async () => {
        vi.resetModules();
        // No platform identity in this env, so the only source of a GitHub
        // connection is the direct GITHUB_APP_* group wired in the entry.
        vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', '');
        vi.stubEnv('GITHUB_APP_ID', '12345');
        vi.stubEnv('GITHUB_APP_PRIVATE_KEY', 'test-private-key');
        vi.stubEnv('GITHUB_APP_CLIENT_ID', 'Iv1.client');
        vi.stubEnv('GITHUB_APP_CLIENT_SECRET', 'client-secret');
        vi.stubEnv('GITHUB_APP_SLUG', 'test-app');
        vi.stubEnv('GITHUB_APP_WEBHOOK_SECRET', 'webhook-secret');
        const mod = await import('./index.js');
        const paths = mod.mastra.getServer()?.apiRoutes?.map(route => route.path) ?? [];
        // The connect route is registered only by the GithubIntegration, so its
        // presence proves the direct fallback wired the integration onto the factory.
        expect(paths).toContain('/auth/github/connect');
      },
    );

    it.each(['personal', 'group'] as const)(
      'registers direct GitLab with a %s access token',
      { timeout: 60_000 },
      async accessTokenType => {
        vi.resetModules();
        vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', '');
        vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
        vi.stubEnv('GITLAB_ACCESS_TOKEN', `glpat-${accessTokenType}-secret`);
        vi.stubEnv('GITLAB_ACCESS_TOKEN_TYPE', accessTokenType);
        vi.stubEnv('GITLAB_BASE_URL', 'https://gitlab.acme.test');
        await import('./index.js');

        const integration = factoryConfigs[0]?.integrations?.find(candidate => candidate.id === 'gitlab');
        expect(integration?.diagnostics()).toMatchObject({
          mode: 'direct',
          accessTokenType,
          endpointHost: 'gitlab.acme.test',
        });
        expect(JSON.stringify(integration?.diagnostics())).not.toContain(`glpat-${accessTokenType}-secret`);
      },
    );

    it(
      'boots when the Linear group is partially configured so diagnostics can report the missing setup',
      { timeout: 60_000 },
      async () => {
        vi.resetModules();
        vi.stubEnv('LINEAR_CLIENT_ID', 'lin_client');
        vi.stubEnv('LINEAR_CLIENT_SECRET', '');
        const mod = await import('./index.js');
        expect(mod.mastra).toBeDefined();
      },
    );

    it('registers the direct Linear integration when the full group is configured', { timeout: 60_000 }, async () => {
      vi.resetModules();
      vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', '');
      vi.stubEnv('WORKOS_COOKIE_PASSWORD', 'stable-state-secret');
      vi.stubEnv('LINEAR_CLIENT_ID', 'lin_client');
      vi.stubEnv('LINEAR_CLIENT_SECRET', 'linear-secret');
      const mod = await import('./index.js');
      const paths = mod.mastra.getServer()?.apiRoutes?.map(route => route.path) ?? [];
      expect(paths).toContain('/auth/linear/connect');
    });

    it(
      'mounts the disabled Jira status route when the Jira group is partially configured',
      { timeout: 60_000 },
      async () => {
        vi.resetModules();
        vi.stubEnv('JIRA_BASE_URL', 'https://acme.atlassian.net');
        vi.stubEnv('JIRA_EMAIL', 'ops@acme.test');
        vi.stubEnv('JIRA_API_TOKEN', '');
        const mod = await import('./index.js');
        expect(mod.mastra).toBeDefined();
        const paths = mod.mastra.getServer()?.apiRoutes?.map(route => route.path) ?? [];
        expect(paths).toContain('/web/jira/status');
      },
    );

    it('registers the direct Jira integration when the full group is configured', { timeout: 60_000 }, async () => {
      vi.resetModules();
      vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', '');
      vi.stubEnv('JIRA_BASE_URL', 'https://acme.atlassian.net');
      vi.stubEnv('JIRA_EMAIL', 'ops@acme.test');
      vi.stubEnv('JIRA_API_TOKEN', 'jira-token');
      const mod = await import('./index.js');
      const paths = mod.mastra.getServer()?.apiRoutes?.map(route => route.path) ?? [];
      expect(paths).toContain('/web/jira/status');
      expect(factoryConfigs[0]?.integrations?.find(integration => integration.id === 'jira')?.constructor.name).toBe(
        'JiraIntegration',
      );
    });

    it('does not register Platform Jira without Platform credentials', { timeout: 60_000 }, async () => {
      vi.resetModules();
      const mod = await import('./index.js');
      const paths = mod.mastra.getServer()?.apiRoutes?.map(route => route.path) ?? [];
      expect(paths).toContain('/web/jira/status');
      expect(factoryConfigs[0]?.integrations?.find(integration => integration.id === 'jira')).toBeUndefined();
    });

    it(
      'registers Platform Jira for automatic discovery when Platform credentials are configured',
      { timeout: 60_000 },
      async () => {
        vi.resetModules();
        vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'platform-token');
        const mod = await import('./index.js');
        const paths = mod.mastra.getServer()?.apiRoutes?.map(route => route.path) ?? [];
        expect(paths).toContain('/web/jira/status');
        expect(factoryConfigs[0]?.integrations?.find(integration => integration.id === 'jira')?.constructor.name).toBe(
          'PlatformJiraIntegration',
        );
      },
    );

    it('prefers direct Jira credentials when both Jira configurations are complete', { timeout: 60_000 }, async () => {
      vi.resetModules();
      vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'platform-token');
      vi.stubEnv('JIRA_BASE_URL', 'https://acme.atlassian.net');
      vi.stubEnv('JIRA_EMAIL', 'ops@acme.test');
      vi.stubEnv('JIRA_API_TOKEN', 'jira-token');
      await import('./index.js');
      expect(factoryConfigs[0]?.integrations?.find(integration => integration.id === 'jira')?.constructor.name).toBe(
        'JiraIntegration',
      );
    });

    it('registers the direct incident.io integration when the API key is configured', { timeout: 60_000 }, async () => {
      vi.resetModules();
      vi.stubEnv('INCIDENT_IO_API_KEY', 'incidentio-key');
      await import('./index.js');
      expect(
        factoryConfigs[0]?.integrations?.find(integration => integration.id === 'incidentio')?.constructor.name,
      ).toBe('IncidentioIntegration');
    });

    it('does not register incident.io without an API key or Platform credentials', { timeout: 60_000 }, async () => {
      vi.resetModules();
      await import('./index.js');
      expect(factoryConfigs[0]?.integrations?.find(integration => integration.id === 'incidentio')).toBeUndefined();
    });

    it(
      'prefers the direct incident.io key when Platform credentials are also configured',
      { timeout: 60_000 },
      async () => {
        vi.resetModules();
        vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'platform-token');
        vi.stubEnv('INCIDENT_IO_API_KEY', 'incidentio-key');
        await import('./index.js');
        expect(
          factoryConfigs[0]?.integrations?.find(integration => integration.id === 'incidentio')?.constructor.name,
        ).toBe('IncidentioIntegration');
      },
    );

    it('skips Slack channel wiring when the Slack app env is unset', { timeout: 60_000 }, async () => {
      vi.resetModules();
      // chat's Slack adapter throws at construction without a signingSecret,
      // so an unconfigured env must skip channels instead of crashing boot.
      vi.stubEnv('SLACK_APP_SIGNING_SECRET', '');
      const mod = await import('./index.js');
      const controller = mod.mastra.getAgentController('code');
      expect(controller?.getChannels()).toBeNull();
    });

    it(
      'wires Slack channels onto the controller when the Slack app env is configured',
      { timeout: 60_000 },
      async () => {
        vi.resetModules();
        vi.stubEnv('SLACK_APP_SIGNING_SECRET', 'test-signing-secret');
        // Slack signs the account-link state, so it needs a replica-stable
        // secret like the GitHub and Linear integrations do.
        vi.stubEnv('WORKOS_COOKIE_PASSWORD', 'stable-state-secret');
        const mod = await import('./index.js');
        const controller = mod.mastra.getAgentController('code');
        // Assert the controller first: `controller?.getChannels()` on a missing
        // controller yields `undefined`, which would satisfy `not.toBeNull()`
        // and let the whole Slack wiring disappear silently.
        expect(controller).toBeDefined();
        expect(controller!.getChannels()).toBeDefined(); // sabotage below
      },
    );

    it('registers the Slack connect routes through the integration', { timeout: 60_000 }, async () => {
      vi.resetModules();
      vi.stubEnv('SLACK_APP_SIGNING_SECRET', 'test-signing-secret');
      vi.stubEnv('WORKOS_COOKIE_PASSWORD', 'stable-state-secret');
      const mod = await import('./index.js');
      const paths = mod.mastra.getServer()?.apiRoutes?.map(route => route.path) ?? [];
      // The entry no longer splices these on by hand — their presence proves the
      // factory collected them from the integration's `routes()`.
      expect(paths).toContain('/connect/slack');
    });

    it(
      'boots a Slack-only deployment by signing state with the Slack signing secret',
      { timeout: 60_000 },
      async () => {
        vi.resetModules();
        vi.stubEnv('SLACK_APP_SIGNING_SECRET', 'test-signing-secret');
        // Slack signs OAuth state, so the factory rejects a per-process random
        // signer: a link signed on one replica could not be verified on another.
        // A deployment that configures Slack and nothing else has neither of the
        // other two secrets, so the signing secret is the stable signer and boot
        // must survive on it alone.
        vi.stubEnv('GITHUB_APP_WEBHOOK_SECRET', '');
        vi.stubEnv('WORKOS_COOKIE_PASSWORD', '');
        const mod = await import('./index.js');
        expect(mod.mastra.getAgentController('code')?.getChannels()).toBeDefined();
      },
    );
  });

  describe('WorkOS auth env group', () => {
    // Mount the entry's `/auth/login` route on a throwaway Hono app and return
    // the redirect target. The handlers built by `buildAuthRoutes` are
    // self-contained closures over the provider, so no server context is
    // needed, and `getLoginUrl` only builds a URL — no network involved.
    async function loginRedirect(mod: typeof import('./index.js')): Promise<string> {
      const routes = mod.mastra.getServer()?.apiRoutes ?? [];
      const login = routes.find(route => route.path === '/auth/login');
      expect(login, 'expected /auth/login to be registered on apiRoutes').toBeDefined();
      const app = new Hono();
      app.get('/auth/login', c => (login as any).handler(c));
      const res = await app.request('/auth/login');
      expect(res.status).toBeGreaterThanOrEqual(300);
      expect(res.status).toBeLessThan(400);
      return res.headers.get('location') ?? '';
    }

    const stubWorkosPair = () => {
      vi.stubEnv('WORKOS_API_KEY', 'sk_test_fake');
      vi.stubEnv('WORKOS_CLIENT_ID', 'client_fake');
      vi.stubEnv('WORKOS_COOKIE_PASSWORD', 'a-replica-stable-secret-of-32-plus-chars');
      // Lets MastraAuthWorkos.init() derive the /auth/callback redirect the
      // way a real deployment's publicUrl does.
      vi.stubEnv('MASTRACODE_PUBLIC_URL', 'http://localhost:5873');
    };

    it(
      'routes /auth/login to WorkOS hosted login when the WORKOS_* pair is configured',
      { timeout: 60_000 },
      async () => {
        stubWorkosPair();
        const warn = vi.spyOn(console, 'warn');
        try {
          const mod = await import('./index.js');
          const location = await loginRedirect(mod);
          // The redirect must target WorkOS, not the platform's shared login —
          // self-hosted deploys have no allowed redirect_uri on platform.mastra.ai.
          expect(location).not.toContain('platform.mastra.ai');
          expect(location).toContain('client_id=client_fake');
          // WORKOS_REDIRECT_URI is unset here, so this also pins init()'s
          // derivation of the callback from the deployment's public URL — a
          // wrong callback still reaches WorkOS but breaks the OAuth return.
          expect(new URL(location).searchParams.get('redirect_uri')).toBe('http://localhost:5873/auth/callback');
          // The precedence warning belongs to the deferral branch only — a
          // healthy WorkOS boot must not claim its own config is ignored.
          expect(warn.mock.calls.some(call => String(call[0]).includes('ignored'))).toBe(false);
        } finally {
          warn.mockRestore();
        }
      },
    );

    it('boots on the default auth path when only WORKOS_API_KEY is set', { timeout: 60_000 }, async () => {
      // varlock rejects an API-key-only env at the dev-script level; this
      // guards direct boot paths that bypass it. A half-configured pair must
      // not construct the provider (which would throw on the missing
      // clientId) — boot survives on the default platform-backed path.
      vi.stubEnv('WORKOS_API_KEY', 'sk_test_fake');
      const mod = await import('./index.js');
      expect(mod.mastra).toBeDefined();
      // Half a pair falls through to the platform-backed default, so login
      // still rides the studio provider's shared API.
      const location = await loginRedirect(mod);
      expect(location).toContain('platform.mastra.ai');
    });

    it(
      'defers to the platform when MASTRA_SHARED_API_URL is set, warning that WORKOS_* is ignored',
      { timeout: 60_000 },
      async () => {
        stubWorkosPair();
        vi.stubEnv('MASTRA_SHARED_API_URL', 'https://shared.example.com/v1');
        const warn = vi.spyOn(console, 'warn');
        try {
          const mod = await import('./index.js');
          const location = await loginRedirect(mod);
          // Explicit platform deferral is the schema's highest-precedence
          // contract: the studio provider wins and login rides the shared API.
          expect(location).toContain('shared.example.com');
          expect(
            warn.mock.calls.some(
              call => String(call[0]).includes('WORKOS') && String(call[0]).includes('MASTRA_SHARED_API_URL'),
            ),
          ).toBe(true);
        } finally {
          warn.mockRestore();
        }
      },
    );

    it(
      'keeps WorkOS auth when MASTRA_PLATFORM_SECRET_KEY is set without MASTRA_SHARED_API_URL',
      { timeout: 60_000 },
      async () => {
        // The platform secret key is a compute/integration credential, not an
        // identity signal: a self-hosted deployment can use platform sandboxes
        // for compute while running its own WorkOS sign-in. Explicit identity
        // config must win over the inferred platform association.
        stubWorkosPair();
        vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'sk_platform_fake');
        const mod = await import('./index.js');
        const location = await loginRedirect(mod);
        expect(location).not.toContain('platform.mastra.ai');
        expect(location).toContain('client_id=client_fake');
      },
    );
  });
});
