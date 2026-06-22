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

import { loadAgentInstructions } from './agent-instructions';

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
});
