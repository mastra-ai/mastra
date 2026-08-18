import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectCodingAgentSkills } from './coding-agents';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-coding-agents-'));
  temporaryDirectories.push(directory);
  return directory;
}

async function createExecutable(directory: string, name: string, mode = 0o755): Promise<void> {
  const filePath = path.join(directory, name);
  await fs.writeFile(filePath, '#!/bin/sh\n');
  await fs.chmod(filePath, mode);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe('detectCodingAgentSkills', () => {
  it.each([
    ['claude', 'claude-code'],
    ['droid', 'droid'],
    ['pi', 'pi'],
  ] as const)('maps the %s executable to the %s skill', async (executable, skill) => {
    const directory = await createTemporaryDirectory();
    await createExecutable(directory, executable);

    await expect(detectCodingAgentSkills({ env: { PATH: directory }, platform: 'linux' })).resolves.toEqual([
      [executable, skill],
    ]);
  });

  it.each(['codex', 'cursor-agent', 'gemini', 'opencode'] as const)(
    'maps the %s executable to universal',
    async executable => {
      const directory = await createTemporaryDirectory();
      await createExecutable(directory, 'claude');
      await createExecutable(directory, executable);

      await expect(detectCodingAgentSkills({ env: { PATH: directory }, platform: 'linux' })).resolves.toEqual([
        ['claude', 'claude-code'],
        [executable, 'universal'],
      ]);
    },
  );

  it('returns skills in the approved order and deduplicates universal', async () => {
    const first = await createTemporaryDirectory();
    const second = await createTemporaryDirectory();
    await createExecutable(first, 'codex');
    await createExecutable(first, 'claude');
    await createExecutable(first, 'gemini');
    await createExecutable(second, 'droid');
    await createExecutable(second, 'pi');
    await createExecutable(second, 'cursor-agent');
    await createExecutable(second, 'opencode');

    await expect(
      detectCodingAgentSkills({ env: { PATH: `${first}${path.delimiter}${second}` }, platform: 'darwin' }),
    ).resolves.toEqual([
      ['claude', 'claude-code'],
      ['droid', 'droid'],
      ['pi', 'pi'],
      ['codex', 'universal'],
    ]);
  });

  it('requires POSIX executable mode and ignores missing entries and non-files', async () => {
    const directory = await createTemporaryDirectory();
    await createExecutable(directory, 'claude', 0o644);
    await fs.mkdir(path.join(directory, 'droid'));

    await expect(
      detectCodingAgentSkills({
        env: { PATH: `${path.join(directory, 'missing')}${path.delimiter}${directory}` },
        platform: 'linux',
      }),
    ).resolves.toEqual([['', 'universal']]);
  });

  it('uses semicolons for Windows PATH and treats executable names and extensions case-insensitively', async () => {
    const first = await createTemporaryDirectory();
    const second = await createTemporaryDirectory();
    await createExecutable(first, 'CLAUDE.eXe', 0o644);
    await createExecutable(second, 'DROID.CMD', 0o644);

    await expect(
      detectCodingAgentSkills({
        env: { PATH: `${first};${second}`, PATHEXT: 'exe;.CmD;EXE' },
        platform: 'win32',
      }),
    ).resolves.toEqual([
      ['claude', 'claude-code'],
      ['droid', 'droid'],
    ]);
  });

  it.each([undefined, '', '   '])('uses the default Windows PATHEXT when PATHEXT is %j', async pathExt => {
    const directory = await createTemporaryDirectory();
    await createExecutable(directory, 'PI.bat', 0o644);

    await expect(
      detectCodingAgentSkills({ env: { PATH: directory, PATHEXT: pathExt }, platform: 'win32' }),
    ).resolves.toEqual([['pi', 'pi']]);
  });

  it('does not split Windows PATH on the host POSIX delimiter', async () => {
    const first = await createTemporaryDirectory();
    const second = await createTemporaryDirectory();
    await createExecutable(second, 'claude.EXE', 0o644);

    await expect(
      detectCodingAgentSkills({ env: { PATH: `${first}:${second}`, PATHEXT: '.EXE' }, platform: 'win32' }),
    ).resolves.toEqual([['', 'universal']]);
  });

  it('requires Windows candidates to be regular files but not POSIX-executable', async () => {
    const directory = await createTemporaryDirectory();
    await fs.mkdir(path.join(directory, 'claude.EXE'));
    await createExecutable(directory, 'droid.COM', 0o644);

    await expect(
      detectCodingAgentSkills({ env: { PATH: directory, PATHEXT: '.exe;.com' }, platform: 'win32' }),
    ).resolves.toEqual([['droid', 'droid']]);
  });

  it('falls back to universal for missing, empty, or unsupported PATH contents', async () => {
    const directory = await createTemporaryDirectory();
    await createExecutable(directory, 'unsupported');

    await expect(detectCodingAgentSkills({ env: {}, platform: 'linux' })).resolves.toEqual([['', 'universal']]);
    await expect(detectCodingAgentSkills({ env: { PATH: '' }, platform: 'linux' })).resolves.toEqual([
      ['', 'universal'],
    ]);
    await expect(detectCodingAgentSkills({ env: { PATH: directory }, platform: 'linux' })).resolves.toEqual([
      ['', 'universal'],
    ]);
  });
});
