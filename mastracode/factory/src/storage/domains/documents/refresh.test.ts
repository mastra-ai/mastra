import { describe, expect, it, vi } from 'vitest';

import type { ExecutableSandbox } from '../../../sandbox/materialization.js';
import { createFactoryStorageForTests } from '../../test-utils.js';
import { createFactoryDocumentsRefresher } from './refresh.js';

const ORG = 'org-1';

function gitSandbox(files: Record<string, string>, sha = 'sha-1') {
  const commands: string[] = [];
  const sandbox: ExecutableSandbox & { setEnv?: never } = {
    id: 'sb',
    async executeCommand(_command, args) {
      const script = args?.[1] ?? '';
      commands.push(script);
      if (script.includes('rev-parse')) return { exitCode: 0, stdout: `${sha}\n`, stderr: '' };
      if (script.includes(' show ')) {
        const key = /show '([^']+)'/.exec(script)?.[1] ?? '';
        const body = files[key];
        return body === undefined
          ? { exitCode: 128, stdout: '', stderr: 'missing' }
          : { exitCode: 0, stdout: body, stderr: '' };
      }
      // fetch, remote set-url, and the scrub all succeed.
      return { exitCode: 0, stdout: '', stderr: '' };
    },
  };
  return { sandbox, commands };
}

async function linkedProject() {
  const seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId: ORG, userId: 'user-1', input: { name: 'Docs' } });
  const scope = { orgId: ORG, factoryProjectId: project.id };
  const handle = seed.sourceControl.forIntegration('github');
  const installation = await handle.installations.upsert({
    orgId: scope.orgId,
    connectedByUserId: 'user-1',
    externalId: '1',
    accountName: 'acme',
  });
  const repository = await handle.repositories.upsert({
    orgId: scope.orgId,
    input: { installationId: installation.id, externalId: 'r1', slug: 'acme/app', defaultBranch: 'main' },
  });
  const connection = await handle.connections.create({
    orgId: scope.orgId,
    factoryProjectId: scope.factoryProjectId,
    installationId: installation.id,
    createdByUserId: 'user-1',
  });
  const link = await handle.projectRepositories.link({
    orgId: scope.orgId,
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'user-1',
    sandboxProvider: 'local',
    sandboxWorkdir: '/work',
  });
  const session = await handle.sessions.create({
    sessionId: 'session-1',
    projectRepositoryId: link.id,
    orgId: scope.orgId,
    userId: 'user-1',
    branch: 'factory/x',
    baseBranch: 'main',
    visibility: 'private',
  });
  return { seed, handle, session, repository, scope };
}

describe('createFactoryDocumentsRefresher', () => {
  it('reports no_repository when the project has no linked repository', async () => {
    const seed = await createFactoryStorageForTests();
    const refresh = createFactoryDocumentsRefresher({
      sourceControl: seed.sourceControl.forIntegration('github'),
      getRepositoryAccess: async () => ({ authorization: { token: 't' } }),
      documents: seed.documents,
      peekSandbox: () => undefined,
    });
    expect(await refresh({ orgId: ORG, factoryProjectId: 'project-1' })).toEqual({ outcome: 'no_repository' });
  });

  it('reports no_active_sandbox when no memoized sandbox has a workdir', async () => {
    const { seed, handle, scope } = await linkedProject();
    const refresh = createFactoryDocumentsRefresher({
      sourceControl: handle,
      getRepositoryAccess: async () => ({ authorization: { token: 't' } }),
      documents: seed.documents,
      peekSandbox: () => ({ sandbox: {} as never }),
    });
    expect(await refresh(scope)).toEqual({ outcome: 'no_active_sandbox' });
  });

  it('fetches the default branch with a scrubbed token and syncs from origin/<default>', async () => {
    const { seed, handle, session, scope } = await linkedProject();
    const { sandbox, commands } = gitSandbox({
      'origin/main:docs/factory/glossary.md': '# Glossary\n\nWords.',
    });
    const getRepositoryAccess = vi.fn(async () => ({ authorization: { token: 'tok-123' } }));
    const refresh = createFactoryDocumentsRefresher({
      sourceControl: handle,
      getRepositoryAccess,
      documents: seed.documents,
      peekSandbox: id => (id === session.id ? { sandbox: sandbox as never, workdir: '/work/app' } : undefined),
    });

    const result = await refresh(scope);

    expect(result).toEqual({ outcome: 'synced', sourceRef: 'origin/main', sourceSha: 'sha-1' });
    expect(getRepositoryAccess).toHaveBeenCalledWith({ orgId: 'org-1', repositoryId: expect.any(String) });
    expect(commands.some(command => command.includes("fetch --depth=1 origin 'main'"))).toBe(true);
    // The token goes onto the remote for the fetch and is scrubbed afterwards.
    expect(commands.some(command => command.includes('remote set-url origin') && command.includes('tok-123'))).toBe(
      true,
    );
    const setUrls = commands.filter(command => command.includes('remote set-url origin'));
    expect(setUrls.at(-1)).not.toContain('tok-123');
    expect((await seed.documents.getByKind(scope, 'glossary'))?.content).toBe('# Glossary\n\nWords.');
  });
});
