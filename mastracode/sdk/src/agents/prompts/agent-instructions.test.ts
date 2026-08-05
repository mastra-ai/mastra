import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, normalize } from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  home: '',
}));

vi.mock('node:os', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    homedir: () => mocks.home,
  };
});

import {
  createGitRefInstructionReader,
  createGitRefReminderReader,
  loadAgentInstructions,
} from './agent-instructions.js';

function write(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content, 'utf-8');
}

describe('loadAgentInstructions', () => {
  let root: string;
  let project: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mastracode-instructions-'));
    mocks.home = join(root, 'home');
    project = join(root, 'project');
    mkdirSync(mocks.home, { recursive: true });
    mkdirSync(project, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('loads project AGENTS.md before CLAUDE.md and ignores singular AGENT.md', () => {
    write(join(project, 'AGENT.md'), 'singular instruction should not load');
    write(join(project, 'CLAUDE.md'), 'claude fallback instruction');
    write(join(project, 'AGENTS.md'), 'agents instruction wins');

    const sources = loadAgentInstructions(project);

    expect(sources).toEqual([
      {
        path: join(project, 'AGENTS.md'),
        content: 'agents instruction wins',
        scope: 'project',
      },
    ]);
    expect(sources.map(source => source.content)).not.toContain('claude fallback instruction');
    expect(sources.map(source => source.content)).not.toContain('singular instruction should not load');
  });

  it('substitutes custom configDir in project-local and XDG global instruction paths', () => {
    write(join(mocks.home, '.config', 'acme-code', 'AGENTS.md'), 'global custom config instructions');
    write(join(project, '.acme-code', 'CLAUDE.md'), 'project custom config instructions');

    const sources = loadAgentInstructions(project, '.acme-code');

    expect(sources).toEqual([
      {
        path: join(mocks.home, '.config', 'acme-code', 'AGENTS.md'),
        content: 'global custom config instructions',
        scope: 'global',
      },
      {
        path: join(project, '.acme-code', 'CLAUDE.md'),
        content: 'project custom config instructions',
        scope: 'project',
      },
    ]);
    expect(sources.map(source => normalize(source.path))).toEqual([
      normalize(join(mocks.home, '.config', 'acme-code', 'AGENTS.md')),
      normalize(join(project, '.acme-code', 'CLAUDE.md')),
    ]);
  });

  it('loads project instructions only when skipGlobal is set', () => {
    write(join(mocks.home, '.claude', 'CLAUDE.md'), 'global instructions');
    write(join(project, 'AGENTS.md'), 'project instructions');

    const sources = loadAgentInstructions(project, undefined, undefined, { skipGlobal: true });

    expect(sources).toEqual([{ path: join(project, 'AGENTS.md'), content: 'project instructions', scope: 'project' }]);
  });
});

describe('git-ref instruction readers', () => {
  let root: string;
  let repo: string;

  const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { stdio: 'ignore' });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mastracode-gitref-'));
    mocks.home = join(root, 'home');
    mkdirSync(mocks.home, { recursive: true });
    repo = join(root, 'repo');
    mkdirSync(repo, { recursive: true });
    git('init', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    writeFileSync(join(repo, 'AGENTS.md'), 'trusted base instructions');
    git('add', 'AGENTS.md');
    git('commit', '-m', 'base');
    // Untrusted checkout tampers with the working tree.
    writeFileSync(join(repo, 'AGENTS.md'), 'INJECTED working-tree content');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('loadAgentInstructions serves project content from the ref, never the working tree', () => {
    const reader = createGitRefInstructionReader(repo, 'main');
    const sources = loadAgentInstructions(repo, undefined, reader);

    expect(sources).toEqual([
      {
        path: join(repo, 'AGENTS.md'),
        content: 'trusted base instructions',
        scope: 'project',
        ref: 'main',
      },
    ]);
  });

  it('reports files as absent when the ref does not exist', () => {
    const reader = createGitRefInstructionReader(repo, 'no-such-branch');
    expect(loadAgentInstructions(repo, undefined, reader)).toEqual([]);
  });

  it('reports working-tree-only files as absent at the ref', () => {
    writeFileSync(join(repo, 'CLAUDE.md'), 'INJECTED new file');
    git('rm', '--cached', 'AGENTS.md');
    git('commit', '-m', 'remove instructions');

    const reader = createGitRefInstructionReader(repo, 'main');
    expect(loadAgentInstructions(repo, undefined, reader)).toEqual([]);
  });

  it('reminder reader resolves project paths at the ref and falls back to fs outside the project', () => {
    const reader = createGitRefReminderReader(repo, 'main');

    expect(reader.pathExists(join(repo, 'AGENTS.md'))).toBe(true);
    expect(reader.readFile(join(repo, 'AGENTS.md'))).toBe('trusted base instructions');
    expect(reader.isDirectory(repo)).toBe(true);
    // Working-tree-only file is invisible at the ref.
    writeFileSync(join(repo, 'CLAUDE.md'), 'INJECTED new file');
    expect(reader.pathExists(join(repo, 'CLAUDE.md'))).toBe(false);
    // Outside the project the operator filesystem is trusted.
    const outside = join(root, 'outside.md');
    writeFileSync(outside, 'operator file');
    expect(reader.pathExists(outside)).toBe(true);
    expect(reader.readFile(outside)).toBe('operator file');
  });
});
