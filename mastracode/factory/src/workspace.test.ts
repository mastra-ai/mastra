import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDynamicWorkspace } from '@mastra/code-sdk/agents/workspace';
import { RequestContext } from '@mastra/core/request-context';
import type { LocalFilesystem } from '@mastra/core/workspace';
import { afterEach, describe, expect, it } from 'vitest';
import { getFactoryWorkspace } from './workspace.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, { recursive: true, force: true })));
});

function createRequestContext(projectPath: string) {
  const requestContext = new RequestContext();
  const getState = () => ({
    projectPath,
    homeDir: projectPath,
    sandboxAllowedPaths: [],
  });
  requestContext.set('controller', {
    modeId: 'build',
    getState,
    session: { state: { get: getState } },
  });
  return requestContext;
}

describe('getFactoryWorkspace', () => {
  it('keeps Factory and default workspace cache identities separate', async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-web-factory-cache-'));
    tempDirs.push(projectPath);
    const requestContext = createRequestContext(projectPath);

    const defaultWorkspace = await getDynamicWorkspace({ requestContext });
    const factoryWorkspace = await getFactoryWorkspace({ requestContext });

    expect(defaultWorkspace.id).toBe(`mastra-code-workspace-${projectPath}`);
    expect(factoryWorkspace.id).toBe(`mastra-code-workspace-${projectPath}-web-factory`);
    expect(factoryWorkspace.id).not.toBe(defaultWorkspace.id);
  });

  it('keeps the reserved skill list aligned with packaged Factory assets', async () => {
    const assetRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'factory-skills');
    const assetNames = (await fs.readdir(assetRoot)).sort();

    expect(assetNames).toEqual(['understand-issue', 'understand-pr']);
    await Promise.all(
      assetNames.map(skillName => expect(fs.stat(path.join(assetRoot, skillName, 'SKILL.md'))).resolves.toBeDefined()),
    );
  });

  it('adds read-only Web Factory skills and keeps them authoritative over project shadows', async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-web-factory-skills-'));
    tempDirs.push(projectPath);
    const shadowDir = path.join(projectPath, '.mastracode', 'skills', 'understand-issue');
    await fs.mkdir(shadowDir, { recursive: true });
    await fs.writeFile(
      path.join(shadowDir, 'SKILL.md'),
      '---\nname: understand-issue\ndescription: Project shadow\n---\n\n# Shadowed Project Skill',
    );

    const workspace = await getFactoryWorkspace({ requestContext: createRequestContext(projectPath) });
    const understandIssue = await workspace.skills?.get('understand-issue');
    const understandPr = await workspace.skills?.get('understand-pr');
    const filesystem = workspace.filesystem as LocalFilesystem;

    expect(workspace.id).toContain('-web-factory');
    expect(understandIssue?.instructions).toContain('# Understand Issue');
    expect(understandIssue?.instructions).not.toContain('# Shadowed Project Skill');
    expect(understandIssue?.metadata).toMatchObject({ goal: true });
    expect(understandPr?.instructions).toContain('# Understand PR');
    expect(understandPr?.metadata).toMatchObject({ goal: true });
    expect(filesystem.allowedPaths).not.toContain('/__mastracode_factory_skills__');
    await expect(filesystem.writeFile(path.join(understandIssue!.path, 'SKILL.md'), 'mutated')).rejects.toMatchObject({
      name: 'PermissionError',
      code: 'EACCES',
    });
  });
});
