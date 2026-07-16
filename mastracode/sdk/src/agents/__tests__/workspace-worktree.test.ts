import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { LocalSkillSource } from '@mastra/core/workspace';
import type { SkillSource, SkillSourceEntry, SkillSourceStat } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../onboarding/settings.js', () => ({
  loadSettings: () => ({}),
}));
vi.mock('../../onboarding/settings.js', () => ({
  loadSettings: () => ({}),
}));

// Capture the workdir the SandboxFilesystem is constructed with so we can assert
// the workspace binds to the worktree path rather than the repo root.
const sandboxFsCalls: Array<{ workdir: string }> = [];
const EXTENSION_MOUNT = '/server-skills';

class TestExtensionSource implements SkillSource {
  readonly #local: LocalSkillSource;

  constructor(
    localRoot: string,
    readonly fallback: SkillSource,
  ) {
    this.#local = new LocalSkillSource({ basePath: localRoot });
  }

  #isExtensionPath(skillPath: string) {
    const normalized = path.normalize(skillPath);
    return normalized === EXTENSION_MOUNT || normalized.startsWith(`${EXTENSION_MOUNT}${path.sep}`);
  }

  #localPath(skillPath: string) {
    return path.relative(EXTENSION_MOUNT, path.normalize(skillPath));
  }

  exists(skillPath: string): Promise<boolean> {
    return this.#isExtensionPath(skillPath)
      ? this.#local.exists(this.#localPath(skillPath))
      : this.fallback.exists(skillPath);
  }

  stat(skillPath: string): Promise<SkillSourceStat> {
    return this.#isExtensionPath(skillPath)
      ? this.#local.stat(this.#localPath(skillPath))
      : this.fallback.stat(skillPath);
  }

  readFile(skillPath: string): Promise<string | Buffer> {
    return this.#isExtensionPath(skillPath)
      ? this.#local.readFile(this.#localPath(skillPath))
      : this.fallback.readFile(skillPath);
  }

  readdir(skillPath: string): Promise<SkillSourceEntry[]> {
    return this.#isExtensionPath(skillPath)
      ? this.#local.readdir(this.#localPath(skillPath))
      : this.fallback.readdir(skillPath);
  }

  realpath(skillPath: string): Promise<string> {
    return this.#isExtensionPath(skillPath)
      ? Promise.resolve(path.normalize(skillPath))
      : (this.fallback.realpath?.(skillPath) ?? Promise.resolve(skillPath));
  }
}

const sandboxSkillFiles = new Map([
  [
    '.mastracode/skills/project-skill/SKILL.md',
    '---\nname: project-skill\ndescription: Sandbox project skill\n---\n\n# Project Skill\n\nLoaded from sandbox.',
  ],
  [
    '.mastracode/skills/understand-issue/SKILL.md',
    '---\nname: understand-issue\ndescription: Shadow attempt\n---\n\n# Shadowed Project Skill',
  ],
]);
vi.mock('../sandbox-filesystem.js', () => ({
  SandboxFilesystem: class {
    workdir: string;
    constructor(opts: { workdir: string }) {
      this.workdir = opts.workdir;
      sandboxFsCalls.push({ workdir: opts.workdir });
    }
    normalize(input: string) {
      return input.replace(/^\/+|\/+$/g, '');
    }
    async exists(input: string) {
      const target = this.normalize(input);
      return sandboxSkillFiles.has(target) || [...sandboxSkillFiles.keys()].some(file => file.startsWith(`${target}/`));
    }
    async stat(input: string) {
      const target = this.normalize(input);
      const content = sandboxSkillFiles.get(target);
      const isDirectory =
        content === undefined && [...sandboxSkillFiles.keys()].some(file => file.startsWith(`${target}/`));
      if (content === undefined && !isDirectory) throw new Error('sandbox path does not exist');
      return {
        name: target.split('/').at(-1) ?? target,
        type: isDirectory ? 'directory' : 'file',
        size: content?.length ?? 0,
        createdAt: new Date(0),
        modifiedAt: new Date(0),
      };
    }
    async readFile(input: string) {
      const target = this.normalize(input);
      const content = sandboxSkillFiles.get(target);
      if (content === undefined) throw new Error('sandbox path does not exist');
      return content;
    }
    async readdir(input: string) {
      const target = this.normalize(input);
      const prefix = target ? `${target}/` : '';
      const entries = new Map<string, 'directory' | 'file'>();
      for (const file of sandboxSkillFiles.keys()) {
        if (!file.startsWith(prefix)) continue;
        const remainder = file.slice(prefix.length);
        const [name, ...tail] = remainder.split('/');
        if (name) entries.set(name, tail.length > 0 ? 'directory' : 'file');
      }
      return [...entries].map(([name, type]) => ({ name, type }));
    }
  },
}));

vi.mock('../sandbox-reattach.js', () => ({
  reattachProjectSandbox: vi.fn(async () => ({
    executeCommand: vi.fn(),
    getInfo: vi.fn(),
  })),
}));

function createSandboxRequestContext(state: Record<string, unknown>) {
  const requestContext = new RequestContext();
  const getState = () => state;
  requestContext.set('controller', {
    modeId: 'build',
    getState,
    session: { state: { get: getState } },
  });
  return requestContext;
}

const baseState = {
  githubProjectId: 'proj-1',
  sandboxId: 'sbx-1',
  sandboxWorkdir: '/workspace/hello',
  sandboxAllowedPaths: [],
};

afterEach(() => {
  sandboxFsCalls.length = 0;
  vi.resetModules();
});

describe('getDynamicWorkspace sandbox worktree binding', () => {
  it('binds the workspace to the repo root when no worktree is active', async () => {
    const { getDynamicWorkspace } = await import('../workspace.js');
    const workspace = await getDynamicWorkspace({
      requestContext: createSandboxRequestContext({ ...baseState }) as any,
    });

    expect(sandboxFsCalls.at(-1)?.workdir).toBe('/workspace/hello');
    // Reuse key embeds the bound workdir (repo root here).
    expect(workspace.id).toBe('mastra-code-workspace-gh-proj-1-sbx-1-/workspace/hello');
  });

  it('loads sandbox project skills without adding Web Factory skills', async () => {
    const { getDynamicWorkspace } = await import('../workspace.js');
    const workspace = await getDynamicWorkspace({
      requestContext: createSandboxRequestContext({ ...baseState }) as any,
    });

    const understandIssue = await workspace.skills?.get('understand-issue');
    const understandPr = await workspace.skills?.get('understand-pr');
    const projectSkill = await workspace.skills?.get('project-skill');

    expect(understandIssue?.path).toBe('.mastracode/skills/understand-issue');
    expect(understandIssue?.instructions).toContain('# Shadowed Project Skill');
    expect(understandPr).toBeNull();
    expect(projectSkill?.path).toBe('.mastracode/skills/project-skill');
    expect(projectSkill?.instructions).toContain('Loaded from sandbox.');
  });

  it('composes an extension source with sandbox-backed project skills', async () => {
    const extensionRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-sandbox-extension-'));
    try {
      const extensionSkillDir = path.join(extensionRoot, 'server-skill');
      await fs.mkdir(extensionSkillDir, { recursive: true });
      await fs.writeFile(
        path.join(extensionSkillDir, 'SKILL.md'),
        '---\nname: server-skill\ndescription: Server extension skill\n---\n\n# Server Skill',
      );
      const { getDynamicWorkspace } = await import('../workspace.js');
      const workspace = await getDynamicWorkspace({
        requestContext: createSandboxRequestContext({ ...baseState }) as any,
        skillExtension: {
          id: 'test-extension',
          paths: [EXTENSION_MOUNT],
          createSource: fallback => new TestExtensionSource(extensionRoot, fallback),
        },
      });

      const extensionSkill = await workspace.skills?.get('server-skill');
      const projectSkill = await workspace.skills?.get('project-skill');

      expect(workspace.id).toBe('mastra-code-workspace-gh-proj-1-sbx-1-/workspace/hello-test-extension');
      expect(extensionSkill?.instructions).toContain('# Server Skill');
      expect(projectSkill?.instructions).toContain('Loaded from sandbox.');
    } finally {
      await fs.rm(extensionRoot, { recursive: true, force: true });
    }
  });

  it('binds the workspace to the worktree path when one is active', async () => {
    const { getDynamicWorkspace } = await import('../workspace.js');
    const workspace = await getDynamicWorkspace({
      requestContext: createSandboxRequestContext({
        ...baseState,
        worktreePath: '/workspace/worktrees/feat-x',
        branch: 'feat/x',
      }) as any,
    });

    expect(sandboxFsCalls.at(-1)?.workdir).toBe('/workspace/worktrees/feat-x');
    // Reuse key includes the worktree path, so a different worktree gets a fresh workspace.
    expect(workspace.id).toBe('mastra-code-workspace-gh-proj-1-sbx-1-/workspace/worktrees/feat-x');
  });

  it('produces distinct reuse keys for different worktrees on the same sandbox', async () => {
    const { getDynamicWorkspace } = await import('../workspace.js');
    const a = await getDynamicWorkspace({
      requestContext: createSandboxRequestContext({
        ...baseState,
        worktreePath: '/workspace/worktrees/feat-a',
      }) as any,
    });
    const b = await getDynamicWorkspace({
      requestContext: createSandboxRequestContext({
        ...baseState,
        worktreePath: '/workspace/worktrees/feat-b',
      }) as any,
    });

    expect(a.id).not.toBe(b.id);
  });
});
