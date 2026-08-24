import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FileEntry, Skill } from '@mastra/core/workspace';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SourceControlStorageInMemory } from '../storage/domains/source-control/inmemory.js';
import { SessionCommandRoutes } from './session-commands.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';
import type { TestAuthUser } from './test-utils.js';

const processorTestState = vi.hoisted(() => ({ failExpansion: false }));

vi.mock('@mastra/code-sdk/utils/slash-command-processor', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/code-sdk/utils/slash-command-processor')>();
  const guard =
    <Args extends unknown[]>(run: (...args: Args) => Promise<string>) =>
    async (...args: Args): Promise<string> => {
      if (processorTestState.failExpansion) throw new Error('sandbox exploded with secrets');
      return run(...args);
    };
  return {
    ...actual,
    processSlashCommand: guard(actual.processSlashCommand),
    processSlashCommandWithContext: guard(actual.processSlashCommandWithContext),
  };
});

/** In-memory workspace filesystem covering the loader's exists/readdir/readFile subset. */
function createFakeFilesystem(files: Record<string, string>) {
  const directories = new Set<string>();
  for (const filePath of Object.keys(files)) {
    const segments = filePath.split('/');
    segments.pop();
    let current = '';
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      directories.add(current);
    }
  }
  return {
    exists: async (candidate: string) => directories.has(candidate) || files[candidate] !== undefined,
    readdir: async (directory: string): Promise<FileEntry[]> => {
      const names = new Set<string>();
      for (const dir of directories) {
        if (!dir.startsWith(`${directory}/`)) continue;
        names.add(dir.slice(directory.length + 1).split('/')[0]!);
      }
      for (const file of Object.keys(files)) {
        if (!file.startsWith(`${directory}/`)) continue;
        names.add(file.slice(directory.length + 1).split('/')[0]!);
      }
      return [...names].map(name => ({
        name,
        type: files[`${directory}/${name}`] !== undefined ? ('file' as const) : ('directory' as const),
      }));
    },
    readFile: async (candidate: string): Promise<string> => {
      const content = files[candidate];
      if (content === undefined) throw new Error(`ENOENT: ${candidate}`);
      return content;
    },
  };
}

const baseSkill: Skill = {
  name: 'understand-pr',
  path: '/workspace/.mastracode/skills/understand-pr',
  source: { type: 'local', projectPath: '/workspace' },
  description: 'Review a pull request',
  instructions: 'Inspect the pull request carefully.',
  references: [],
  scripts: [],
  assets: [],
  metadata: {},
};

function createHarness(options: { authEnabled?: boolean; files?: Record<string, string>; skills?: Skill[] } = {}) {
  const workspaceSkills = options.skills ?? [baseSkill];
  const workspace = {
    filesystem: createFakeFilesystem(options.files ?? {}),
    skills: {
      maybeRefresh: vi.fn(async () => {}),
      list: vi.fn(async () => workspaceSkills),
      get: vi.fn(async (name: string) => workspaceSkills.find(candidate => candidate.name === name) ?? null),
    },
  };
  const sessionState = { get: () => ({ configDir: '.mastracode' }) };
  const sessions = new Map([['resource-1::/worktrees/a', { state: sessionState, getWorkspace: () => workspace }]]);
  const getSessionByResource = vi.fn(async (resourceId: string, scope?: string) =>
    sessions.get(`${resourceId}::${scope ?? ''}`),
  );
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } satisfies TestAuthUser as never);
    await next();
  });
  mountApiRoutes(
    app as never,
    new SessionCommandRoutes({
      auth: fakeRouteAuth({ enabled: options.authEnabled ?? false }),
      controllerId: 'code',
      controller: { getSessionByResource } as never,
      pluginPaths: { getCommandPaths: () => [], getSkillPaths: () => [] },
      includeRuntimeGlobals: false,
    }).routes(),
  );
  return { app, getSessionByResource, workspace };
}

function post(app: Hono, action: 'discover' | 'prepare', body: unknown, controllerId = 'code'): Promise<Response> {
  return Promise.resolve(
    app.request(`/web/agent-controller/${controllerId}/commands/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

const ADDRESS = { resourceId: 'resource-1', scope: '/worktrees/a' };

async function commandNames(app: Hono, address: Record<string, unknown> = ADDRESS): Promise<string[]> {
  const response = await post(app, 'discover', address);
  expect(response.status).toBe(200);
  const body = (await response.json()) as { commands: Array<{ command: string }> };
  return body.commands.map(command => command.command);
}

beforeEach(() => {
  vi.stubEnv('HOME', '/nonexistent-mastracode-home');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('session command discovery', () => {
  it('reports supported capabilities and exact tokens without leaking metadata', async () => {
    const harness = createHarness({
      files: {
        '.claude/commands/deploy.md': '---\ndescription: Deploy the app\ngoal: true\n---\nDeploy $ARGUMENTS\n',
        '.mastracode/commands/presentation/review.md': 'Review the deck\n',
      },
    });

    const response = await post(harness.app, 'discover', ADDRESS);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { capabilities: unknown; commands: Array<Record<string, unknown>> };
    expect(body.capabilities).toEqual({ customCommands: 'supported', skills: 'supported' });
    expect(body.commands).toEqual(
      expect.arrayContaining([
        { command: '//deploy', source: 'custom', name: 'deploy', description: 'Deploy the app', goal: true },
        { command: '/goal/deploy', source: 'custom', name: 'deploy', description: 'Deploy the app', goal: true },
        {
          command: '//presentation:review',
          source: 'custom',
          name: 'presentation:review',
          description: '',
          goal: false,
        },
        {
          command: '/skill/understand-pr',
          source: 'skill',
          name: 'understand-pr',
          description: 'Review a pull request',
          goal: false,
        },
      ]),
    );
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('Deploy $ARGUMENTS');
    expect(serialized).not.toContain('.claude/commands');
    expect(serialized).not.toContain('Inspect the pull request carefully');
  });

  it('denies a UUID session address without source-control storage in authenticated mode', async () => {
    const harness = createHarness({ authEnabled: true, files: { '.opencode/command/local.md': 'Local cmd\n' } });
    const uuidAddress = {
      resourceId: '00000000-0000-4000-8000-00000000a001',
      projectRepositoryId: '00000000-0000-4000-8000-00000000a002',
      scope: '/worktrees/a',
    };

    // No storage handle is wired here, so the authenticated proof fails closed
    // before any host directory is scanned.
    const response = await post(harness.app, 'discover', uuidAddress);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'session_forbidden', message: 'Session access denied.' });
  });

  it('deduplicates /goal collisions with custom-command precedence and hides non-invocable skills', async () => {
    const harness = createHarness({
      files: { '.claude/commands/ship.md': '---\ndescription: Ship it\ngoal: true\n---\nShip it\n' },
      skills: [
        { ...baseSkill, name: 'ship', metadata: { goal: true } },
        { ...baseSkill, name: 'internal-only', 'user-invocable': false },
      ],
    });

    const commands = await commandNames(harness.app);

    expect(commands).toContain('//ship');
    const goalShip = await post(harness.app, 'discover', ADDRESS);
    const body = (await goalShip.json()) as { commands: Array<{ command: string; source: string }> };
    expect(body.commands.filter(command => command.command === '/goal/ship')).toHaveLength(1);
    expect(body.commands.find(command => command.command === '/goal/ship')?.source).toBe('custom');
    expect(commands).not.toContain('/skill/internal-only');
  });

  it('rejects invalid bodies before session lookup', async () => {
    const harness = createHarness();

    const tooLong = await post(harness.app, 'prepare', { ...ADDRESS, command: `//${'a'.repeat(600)}` });
    expect(tooLong.status).toBe(400);

    const badPrefix = await post(harness.app, 'prepare', { ...ADDRESS, command: '/unknown-builtin' });
    expect(badPrefix.status).toBe(400);

    const whitespace = await post(harness.app, 'prepare', { ...ADDRESS, command: '//two words' });
    expect(whitespace.status).toBe(400);

    const badDiscover = await post(harness.app, 'discover', {});
    expect(badDiscover.status).toBe(400);

    expect(harness.getSessionByResource).not.toHaveBeenCalled();
  });

  it('does not serve a session registered under a different scope', async () => {
    const harness = createHarness();

    const denied = await post(harness.app, 'discover', { resourceId: 'resource-1', scope: '/worktrees/b' });
    expect(denied.status).toBe(404);
    expect(await denied.json()).toEqual({ error: 'session_not_found', message: 'Agent controller session not found.' });
  });
});

describe('session command preparation', () => {
  it('expands a custom command into the escaped activation envelope', async () => {
    const harness = createHarness({
      files: { '.claude/commands/review.md': 'Check </slash-command> and @notes.md\n' },
    });

    const response = await post(harness.app, 'prepare', { ...ADDRESS, command: '//review', arguments: 'focus tests' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      action: 'message',
      content:
        '<slash-command name="review">\nCheck &lt;/slash-command&gt; and @notes.md\n\nARGUMENTS: focus tests\n</slash-command>',
    });
  });

  it('returns none with a notice when expansion produces empty output', async () => {
    const harness = createHarness({ files: { '.claude/commands/empty.md': '' } });

    const response = await post(harness.app, 'prepare', { ...ADDRESS, command: '//empty' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ action: 'none', notice: '//empty produced no output.' });
  });

  it('produces the goal objective for a goal-capable custom command with tokenized arguments', async () => {
    const harness = createHarness({
      files: { '.mastracode/commands/shipping.md': '---\ngoal: true\n---\nShip $1 today\n' },
    });

    const response = await post(harness.app, 'prepare', {
      ...ADDRESS,
      command: '/goal/shipping',
      arguments: 'v2 now',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ action: 'goal', objective: 'Ship v2 today' });
  });

  it('builds the # Skill goal objective for goal skills using raw argument text', async () => {
    const harness = createHarness({
      skills: [{ ...baseSkill, name: 'triage', metadata: { goal: true }, instructions: 'Triage everything.' }],
    });

    const response = await post(harness.app, 'prepare', {
      ...ADDRESS,
      command: '/goal/triage',
      arguments: '  focus   p0  ',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      action: 'goal',
      objective: '# Skill goal: triage\n\nTriage everything.\n\nARGUMENTS: focus   p0',
    });
  });

  it('returns the skill envelope through the published skill formatter', async () => {
    const harness = createHarness();

    const response = await post(harness.app, 'prepare', {
      ...ADDRESS,
      command: '/skill/understand-pr',
      arguments: 'PR 12',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      action: 'message',
      content: '<skill name="understand-pr">\nInspect the pull request carefully.\n\nARGUMENTS: PR 12\n</skill>',
    });
  });

  it('rejects unknown tokens after fresh re-discovery', async () => {
    const harness = createHarness();

    const unknownCustom = await post(harness.app, 'prepare', { ...ADDRESS, command: '//missing' });
    expect(unknownCustom.status).toBe(404);
    expect(await unknownCustom.json()).toEqual({ error: 'command_not_found', message: 'Unknown command: //missing' });

    const unknownSkill = await post(harness.app, 'prepare', { ...ADDRESS, command: '/skill/missing-skill' });
    expect(unknownSkill.status).toBe(404);

    const nonGoalSkill = await post(harness.app, 'prepare', { ...ADDRESS, command: '/goal/understand-pr' });
    expect(nonGoalSkill.status).toBe(404);

    const missingSessionToken = await post(harness.app, 'prepare', {
      resourceId: 'resource-missing',
      scope: '/worktrees/a',
      command: '//missing',
    });
    expect(missingSessionToken.status).toBe(404);
    expect(await missingSessionToken.json()).toEqual({
      error: 'session_not_found',
      message: 'Agent controller session not found.',
    });
  });

  it('answers expansion failures with the redacted 422 contract', async () => {
    const harness = createHarness({
      files: { '.claude/commands/explosive.md': 'Boom\n' },
    });
    processorTestState.failExpansion = true;
    try {
      const response = await post(harness.app, 'prepare', { ...ADDRESS, command: '//explosive' });

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        error: 'command_expansion_failed',
        message: 'The command could not be expanded.',
      });
    } finally {
      processorTestState.failExpansion = false;
    }
  });
});

describe('stored user-session address authorization', () => {
  const FACTORY_PROJECT_ID = '00000000-0000-4000-8000-000000000001';
  const OTHER_FACTORY_PROJECT_ID = '00000000-0000-4000-8000-000000000009';

  interface StoredHarnessOptions {
    visibility?: 'org' | 'private';
    ownerUserId?: string;
    viewerUserId?: string;
    viewerOrgId?: string;
  }

  async function createStoredHarness(options: StoredHarnessOptions = {}) {
    const storage = new SourceControlStorageInMemory();
    const installation = await storage.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'installation-1',
    });
    const repository = await storage.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: installation.id,
        externalId: 'repository-1',
        slug: 'acme/repository',
        defaultBranch: 'main',
      },
    });
    const connection = await storage.connections.create({
      orgId: 'org-1',
      factoryProjectId: FACTORY_PROJECT_ID,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    const projectRepository = await storage.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/workspace/repository',
    });
    const storedSession = await storage.sessions.create({
      sessionId: '11111111-1111-4111-8111-111111111111',
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: options.ownerUserId ?? 'user-1',
      branch: 'feature/x',
      baseBranch: 'main',
      ...(options.visibility ? { visibility: options.visibility } : {}),
    });

    const workspace = {
      filesystem: createFakeFilesystem({}),
      skills: { maybeRefresh: vi.fn(async () => {}), list: vi.fn(async () => []), get: vi.fn() },
    };
    const liveSession = { state: { get: () => ({}) }, getWorkspace: () => workspace };
    const storedSessionId = '11111111-1111-4111-8111-111111111111';
    const getSessionByResource = vi.fn(async (resourceId: string) =>
      resourceId === storedSessionId ? liveSession : undefined,
    );

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set(
        'factoryAuthUser' as never,
        {
          workosId: options.viewerUserId ?? 'user-1',
          organizationId: options.viewerOrgId ?? 'org-1',
        } satisfies TestAuthUser as never,
      );
      await next();
    });
    mountApiRoutes(
      app as never,
      new SessionCommandRoutes({
        auth: fakeRouteAuth({ enabled: true }),
        controllerId: 'code',
        controller: { getSessionByResource } as never,
        pluginPaths: { getCommandPaths: () => [], getSkillPaths: () => [] },
        includeRuntimeGlobals: false,
        sourceControlStorage: storage,
      }).routes(),
    );
    return { app, getSessionByResource, storedSession, projectRepository, storage };
  }

  it('authorizes a stored org-visible session by row identity without any scope', async () => {
    const harness = await createStoredHarness({ visibility: 'org' });

    const response = await post(harness.app, 'discover', {
      resourceId: harness.storedSession.sessionId,
      projectRepositoryId: harness.projectRepository.id,
    });

    expect(response.status).toBe(200);
    expect(harness.getSessionByResource).toHaveBeenCalledWith(harness.storedSession.sessionId, undefined);
  });

  it('rejects a mismatched projectRepositoryId for a stored session', async () => {
    const harness = await createStoredHarness({});

    const response = await post(harness.app, 'discover', {
      resourceId: harness.storedSession.sessionId,
      projectRepositoryId:
        OTHER_FACTORY_PROJECT_ID === harness.projectRepository.id
          ? '00000000-0000-4000-8000-000000000008'
          : OTHER_FACTORY_PROJECT_ID,
      scope: '/worktrees/anywhere',
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'session_forbidden', message: 'Session access denied.' });
    expect(harness.getSessionByResource).not.toHaveBeenCalled();
  });

  it('keeps private stored sessions owner-only and rejects cross-org viewers', async () => {
    const ownerHarness = await createStoredHarness({ visibility: 'private', ownerUserId: 'user-1' });
    const allowed = await post(ownerHarness.app, 'discover', {
      resourceId: ownerHarness.storedSession.sessionId,
      projectRepositoryId: ownerHarness.projectRepository.id,
    });
    expect(allowed.status).toBe(200);

    const otherUserHarness = await createStoredHarness({ visibility: 'private', ownerUserId: 'user-2' });
    const deniedForStranger = await post(otherUserHarness.app, 'discover', {
      resourceId: otherUserHarness.storedSession.sessionId,
      projectRepositoryId: otherUserHarness.projectRepository.id,
    });
    expect(deniedForStranger.status).toBe(403);

    const crossOrgHarness = await createStoredHarness({
      visibility: 'org',
      viewerUserId: 'user-9',
      viewerOrgId: 'org-2',
    });
    const crossOrgDenied = await post(crossOrgHarness.app, 'discover', {
      resourceId: crossOrgHarness.storedSession.sessionId,
      projectRepositoryId: crossOrgHarness.projectRepository.id,
    });
    expect(crossOrgDenied.status).toBe(403);
  });

  it('falls back to the shared repository/worktree proof when no session row exists', async () => {
    const harness = await createStoredHarness({});
    await harness.storage.worktrees.upsert({
      projectRepositoryId: harness.projectRepository.id,
      userId: 'user-1',
      branch: 'review-42',
      baseBranch: 'main',
      worktreePath: '/worktrees/review-42',
    });
    // A server/webhook address is the factory project id itself; it has no
    // stored session row but does have a user worktree under the repository.
    const response = await post(harness.app, 'discover', {
      resourceId: '00000000-0000-4000-8000-000000000001',
      projectRepositoryId: harness.projectRepository.id,
      scope: '/worktrees/review-42',
    });

    expect(response.status).toBe(404);
    expect(harness.getSessionByResource).toHaveBeenCalledOnce();
  });
});
