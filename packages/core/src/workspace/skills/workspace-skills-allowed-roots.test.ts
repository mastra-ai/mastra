import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SkillsProcessor } from '../../processors/processors/skills';
import { PermissionError } from '../errors';
import { LocalFilesystem } from '../filesystem/local-filesystem';
import { Workspace } from '../workspace';

/**
 * Counts every filesystem call LocalFilesystem makes, so cost is measured in
 * syscalls rather than wall-clock time. Counting only; behavior is unchanged.
 * Listed in vitest.isolated-tests.ts so these mocks bind for this file.
 */
const counter = vi.hoisted(() => ({ calls: 0, comparisons: 0 }));

// Root containment is decided with path.relative; counting it measures the
// in-memory work per operation that does not show up as syscalls.
vi.mock('node:path', async importOriginal => {
  const actual = await importOriginal<typeof import('node:path')>();
  return {
    ...actual,
    relative: (...args: Parameters<typeof actual.relative>) => {
      counter.comparisons++;
      return actual.relative(...args);
    },
  };
});

vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const realpathSync = Object.assign(
    (...args: Parameters<typeof actual.realpathSync>) => {
      counter.calls++;
      return actual.realpathSync(...args);
    },
    {
      native: (...args: Parameters<typeof actual.realpathSync.native>) => {
        counter.calls++;
        return actual.realpathSync.native(...args);
      },
    },
  );
  return {
    ...actual,
    realpathSync,
    lstatSync: ((...args: Parameters<typeof actual.lstatSync>) => {
      counter.calls++;
      return actual.lstatSync(...args);
    }) as typeof actual.lstatSync,
    readlinkSync: ((...args: Parameters<typeof actual.readlinkSync>) => {
      counter.calls++;
      return actual.readlinkSync(...args);
    }) as typeof actual.readlinkSync,
  };
});

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const counted =
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    (...args: A): R => {
      counter.calls++;
      return fn(...args);
    };
  return {
    ...actual,
    realpath: counted(actual.realpath),
    open: counted(actual.open),
    stat: counted(actual.stat),
    lstat: counted(actual.lstat),
    readdir: counted(actual.readdir),
    readFile: counted(actual.readFile),
    access: counted(actual.access),
  };
});

const SKILLS = 32;

async function writeSkills(dir: string, count: number): Promise<string[]> {
  const skillDirs: string[] = [];
  for (let i = 0; i < count; i++) {
    const skillDir = path.join(dir, 'skills', `skill-${i}`);
    await fs.mkdir(path.join(skillDir, 'references'), { recursive: true });
    await fs.writeFile(
      path.join(skillDir, 'SKILL.md'),
      `---\nname: skill-${i}\ndescription: Skill ${i}\n---\n# Skill ${i}\n`,
    );
    await fs.writeFile(path.join(skillDir, 'references', 'ref.md'), `ref ${i}\n`);
    skillDirs.push(skillDir);
  }
  return skillDirs;
}

async function measure(fn: () => Promise<unknown>): Promise<number> {
  const before = counter.calls;
  await fn();
  return counter.calls - before;
}

async function measureComparisons(fn: () => Promise<unknown>): Promise<number> {
  const before = counter.comparisons;
  await fn();
  return counter.comparisons - before;
}

describe('Workspace skills with one allowedPaths root per skill (#30224)', () => {
  let temp: string;
  let project: string;
  let skillDirs: string[];

  beforeEach(async () => {
    temp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-skill-roots-')));
    project = path.join(temp, 'project');
    await fs.mkdir(project);
    skillDirs = await writeSkills(temp, SKILLS);
  });

  afterEach(async () => {
    await fs.rm(temp, { recursive: true, force: true });
  });

  /** Same skills, exposed either through one shared root or one root per skill. */
  async function createWorkspace(rootsPerSkill: boolean): Promise<Workspace> {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({
        basePath: project,
        allowedPaths: rootsPerSkill ? skillDirs : [path.join(temp, 'skills')],
      }),
      skills: skillDirs,
    });
    await workspace.init();
    return workspace;
  }

  // Technical: every contained op realpath'd every configured root, so with one
  // root per skill a list() cost O(skills × roots) syscalls. A contained op must
  // cost the same whether the skill sits under one shared root or its own root.
  it('first skills.list() does no more filesystem work with per-skill roots than with one shared root', async () => {
    const shared = await createWorkspace(false);
    const sharedCalls = await measure(() => shared.skills!.list());

    const perSkill = await createWorkspace(true);
    const perSkillCalls = await measure(() => perSkill.skills!.list());

    expect(sharedCalls).toBeGreaterThan(0);
    expect((await perSkill.skills!.list()).map(s => s.name).sort()).toEqual(
      (await shared.skills!.list()).map(s => s.name).sort(),
    );
    // Allow resolving each configured root once; nothing that scales with skills × roots.
    expect(perSkillCalls).toBeLessThanOrEqual(sharedCalls + 2 * SKILLS);
  });

  it('later skills.list() calls do no more filesystem work with per-skill roots than with one shared root', async () => {
    const shared = await createWorkspace(false);
    await shared.skills!.list();
    const sharedCalls = await measure(() => shared.skills!.list());

    const perSkill = await createWorkspace(true);
    await perSkill.skills!.list();
    const perSkillCalls = await measure(() => perSkill.skills!.list());

    expect(sharedCalls).toBeGreaterThan(0);
    expect(perSkillCalls).toBeLessThanOrEqual(sharedCalls);
  });

  it('later skills.list() calls do no more root comparisons with per-skill roots than with one shared root', async () => {
    const shared = await createWorkspace(false);
    await shared.skills!.list();
    const sharedComparisons = await measureComparisons(() => shared.skills!.list());

    const perSkill = await createWorkspace(true);
    await perSkill.skills!.list();
    const perSkillComparisons = await measureComparisons(() => perSkill.skills!.list());

    expect(sharedComparisons).toBeGreaterThan(0);
    expect(perSkillComparisons).toBeLessThanOrEqual(sharedComparisons);
  });

  it('an agent step reads the skills catalog from disk once', async () => {
    const workspace = await createWorkspace(true);
    const processor = new SkillsProcessor({ workspace });
    const step = (stepNumber: number) =>
      processor.processInputStep({
        messageList: { addSystem: () => {} },
        stepNumber,
        tools: {},
      } as unknown as Parameters<SkillsProcessor['processInputStep']>[0]);
    await step(0);

    const listCalls = await measure(() => workspace.skills!.list());
    const stepCalls = await measure(() => step(1));

    // One list() plus one in-memory get() per skill; a second list() would double it.
    expect(listCalls).toBeGreaterThan(0);
    expect(stepCalls).toBeLessThan(listCalls * 1.5);
  });

  it('still rejects a symlink inside a skill that points outside every root', async () => {
    const outside = path.join(temp, 'outside');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'secret.md'), 'TOP-SECRET');
    await fs.symlink(path.join(outside, 'secret.md'), path.join(skillDirs[3]!, 'references', 'escape.md'));

    const workspace = await createWorkspace(true);
    // Warm any cached root state first, so the escape is checked on the fast path.
    await workspace.skills!.list();
    await expect(workspace.skills!.getReference('skill-3', 'references/ref.md')).resolves.toBe('ref 3\n');

    const escapePath = path.join(skillDirs[3]!, 'references', 'escape.md');
    await expect(workspace.filesystem!.readFile(escapePath, { encoding: 'utf-8' })).rejects.toThrow(PermissionError);
    await expect(workspace.filesystem!.stat(escapePath)).rejects.toThrow(PermissionError);
    const viaSkill = await workspace.skills!.getReference('skill-3', 'references/escape.md').catch(() => null);
    expect(viaSkill).toBeNull();
  });

  it('follows an allowed root symlink that is retargeted after first use', async () => {
    const releaseA = path.join(temp, 'release-a');
    const releaseB = path.join(temp, 'release-b');
    await fs.mkdir(releaseA);
    await fs.mkdir(releaseB);
    await fs.writeFile(path.join(releaseA, 'notes.md'), 'A');
    await fs.writeFile(path.join(releaseB, 'notes.md'), 'B');
    const current = path.join(temp, 'current');
    await fs.symlink(releaseA, current);

    const filesystem = new LocalFilesystem({ basePath: project, allowedPaths: [...skillDirs, current] });
    await filesystem.init();
    await expect(filesystem.readFile(path.join(current, 'notes.md'), { encoding: 'utf-8' })).resolves.toBe('A');
    await expect(filesystem.readFile(path.join(releaseA, 'notes.md'), { encoding: 'utf-8' })).resolves.toBe('A');

    await fs.rm(current);
    await fs.symlink(releaseB, current);

    // The root now means release-b; release-a is no longer allowed.
    await expect(filesystem.readFile(path.join(current, 'notes.md'), { encoding: 'utf-8' })).resolves.toBe('B');
    await expect(filesystem.readFile(path.join(releaseA, 'notes.md'), { encoding: 'utf-8' })).rejects.toThrow(
      PermissionError,
    );
    expect(filesystem.resolveAbsolutePath(path.join(releaseA, 'notes.md'))).toBeUndefined();
  });
});
