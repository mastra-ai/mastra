import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { FileSystemBehaviorResolver, InMemoryBehaviorResolver } from './resolver.js';

const node = (instructions: string) => ({
  version: '1', instructions, skills: [], tools: [], guards: [], judge: false,
});

let tempDir: string | undefined;
afterEach(async () => {
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe('behavior resolvers', () => {
  it('mutates a path-indexed TypeScript behavior tree at runtime', async () => {
    const resolver = new InMemoryBehaviorResolver('coding', node('root'));
    resolver.set('$root/behaviors/investigate', node('inspect first'));
    expect((await resolver.children('$root')).map(item => item.id)).toEqual(['$root/behaviors/investigate']);
    resolver.set('$root/behaviors/investigate', node('inspect carefully'));
    expect((await resolver.resolve('$root/behaviors/investigate'))?.instructions).toBe('inspect carefully');
    resolver.remove('$root/behaviors/investigate');
    expect(await resolver.children('$root')).toEqual([]);
  });

  it('discovers nested BEHAVIOR.md nodes and reads frontmatter assets', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'behavior-resolver-'));
    await fs.mkdir(path.join(tempDir, 'behaviors', 'investigate', 'behaviors', 'implement'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'behaviors', 'investigate', 'skills'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'BEHAVIOR.md'), '---\ntools: [read]\n---\nStart here.');
    await fs.writeFile(path.join(tempDir, 'behaviors', 'investigate', 'BEHAVIOR.md'), '---\nmodel: test-model\nskills: [skills/debug.md]\n---\nInvestigate.');
    await fs.writeFile(path.join(tempDir, 'behaviors', 'investigate', 'skills', 'debug.md'), '# Debug');
    await fs.writeFile(path.join(tempDir, 'behaviors', 'investigate', 'behaviors', 'implement', 'BEHAVIOR.md'), 'Implement.');
    const resolver = await FileSystemBehaviorResolver.create(tempDir!, 'coding');
    expect((await resolver.resolve('$root'))?.instructions).toBe('Start here.');
    const investigate = (await resolver.children('$root'))[0]!;
    expect(investigate).toMatchObject({ id: '$root/behaviors/investigate', model: 'test-model' });
    expect(investigate.skills[0]).toContain('skills/debug.md');
    expect((await resolver.children(investigate.id))[0]?.id).toBe('$root/behaviors/investigate/behaviors/implement');
  });

  it('reflects filesystem changes without rebuilding a global graph', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'behavior-resolver-'));
    await fs.writeFile(path.join(tempDir, 'BEHAVIOR.md'), 'Version one.');
    const resolver = await FileSystemBehaviorResolver.create(tempDir!);
    const first = await resolver.resolve('$root');
    await fs.writeFile(path.join(tempDir, 'BEHAVIOR.md'), 'Version two.');
    const second = await resolver.resolve('$root');
    expect(second?.instructions).toBe('Version two.');
    expect(second?.version).not.toBe(first?.version);
  });

  it('supports declared absolute destinations in addition to discovered children', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'behavior-resolver-'));
    await fs.mkdir(path.join(tempDir, 'shared'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'BEHAVIOR.md'), '---\ndestinations: [$root/shared]\n---\nRoot.');
    await fs.writeFile(path.join(tempDir, 'shared', 'BEHAVIOR.md'), 'Shared.');
    const resolver = await FileSystemBehaviorResolver.create(tempDir!);
    expect((await resolver.children('$root')).map(item => item.id)).toContain('$root/shared');
  });

  it('rejects traversal and symlink escapes', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'behavior-resolver-'));
    await fs.writeFile(path.join(tempDir, 'BEHAVIOR.md'), 'Root.');
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'behavior-outside-'));
    await fs.writeFile(path.join(outside, 'BEHAVIOR.md'), 'Outside.');
    await fs.symlink(outside, path.join(tempDir, 'escape'));
    const resolver = await FileSystemBehaviorResolver.create(tempDir!);
    await expect(resolver.resolve('$root/../outside' as never)).rejects.toThrow('may not traverse');
    await expect(resolver.resolve('$root/escape')).rejects.toThrow('symlink escapes');
    await fs.rm(outside, { recursive: true, force: true });
  });
});
