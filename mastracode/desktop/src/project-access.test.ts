import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { ProjectAccessPolicy, projectPathMutation } from './project-access.js';

const temporaryRoots: string[] = [];

async function temporaryDirectory(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('ProjectAccessPolicy', () => {
  it('allows the default root while requiring approval for external directories', async () => {
    const defaultRoot = await temporaryDirectory('mastracode-default-root-');
    const externalRoot = await temporaryDirectory('mastracode-external-root-');
    const storageRoot = await temporaryDirectory('mastracode-policy-');
    const storagePath = join(storageRoot, 'approved-projects.json');
    const policy = await ProjectAccessPolicy.load(storagePath, defaultRoot);
    const resolvedExternalRoot = await realpath(externalRoot);

    expect(await policy.isAllowed(defaultRoot)).toBe(true);
    expect(await policy.isAllowed(externalRoot)).toBe(false);
    await expect(policy.approve(externalRoot)).resolves.toBe(resolvedExternalRoot);
    expect(await policy.isAllowed(externalRoot)).toBe(true);
    const stored: unknown = JSON.parse(await readFile(storagePath, 'utf8'));
    expect(stored).toEqual({ version: 1, roots: [resolvedExternalRoot] });
  });

  it('reloads persisted approvals', async () => {
    const defaultRoot = await temporaryDirectory('mastracode-default-root-');
    const externalRoot = await temporaryDirectory('mastracode-external-root-');
    const storageRoot = await temporaryDirectory('mastracode-policy-');
    const storagePath = join(storageRoot, 'approved-projects.json');
    await (await ProjectAccessPolicy.load(storagePath, defaultRoot)).approve(externalRoot);

    const reloaded = await ProjectAccessPolicy.load(storagePath, defaultRoot);
    expect(await reloaded.isAllowed(externalRoot)).toBe(true);
  });
});

describe('projectPathMutation', () => {
  it('extracts paths from session creation and state updates only', () => {
    expect(
      projectPathMutation('POST', '/api/agent-controller/code/sessions', {
        tags: { projectPath: '/repo' },
      }),
    ).toBe('/repo');
    expect(
      projectPathMutation('PUT', '/api/agent-controller/code/sessions/resource/state', {
        state: { projectPath: '/worktree' },
      }),
    ).toBe('/worktree');
    expect(projectPathMutation('POST', '/api/agent-controller/code/sessions/resource/messages', {})).toBeUndefined();
  });
});
