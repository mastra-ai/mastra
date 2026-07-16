import { RequestContext } from '@mastra/core/request-context';
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

  it('combines read-only Factory skills with sandbox project skills and preserves Factory precedence', async () => {
    const { getDynamicWorkspace } = await import('../workspace.js');
    const workspace = await getDynamicWorkspace({
      requestContext: createSandboxRequestContext({ ...baseState }) as any,
    });

    const understandIssue = await workspace.skills?.get('understand-issue');
    const understandPr = await workspace.skills?.get('understand-pr');
    const projectSkill = await workspace.skills?.get('project-skill');

    expect(understandIssue?.path).toBe('/__mastracode_server_skills__/understand-issue');
    expect(understandIssue?.instructions).toContain('# Understand Issue');
    expect(understandIssue?.instructions).not.toContain('# Shadowed Project Skill');
    expect(understandPr?.path).toBe('/__mastracode_server_skills__/understand-pr');
    expect(understandPr?.instructions).toContain('# Understand PR');
    expect(projectSkill?.path).toBe('.mastracode/skills/project-skill');
    expect(projectSkill?.instructions).toContain('Loaded from sandbox.');
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
