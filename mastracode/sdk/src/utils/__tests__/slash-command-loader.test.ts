import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';

import type { FileEntry } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadCustomCommands,
  loadGlobalCustomCommands,
  loadWorkspaceCustomCommands,
  parseCommandFile,
  scanCommandDirectory,
} from '../slash-command-loader.js';

interface FakeWorkspaceFile {
  content: string;
}

/** In-memory stand-in for the subset of WorkspaceFilesystem the loader uses. */
function createFakeWorkspaceFilesystem(files: Record<string, string>, directories: string[] = []) {
  const dirSet = new Set(directories);
  for (const filePath of Object.keys(files)) {
    const segments = filePath.split('/');
    segments.pop();
    let current = '';
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      dirSet.add(current);
    }
  }

  return {
    exists: async (path: string) => dirSet.has(path) || files[path] !== undefined,
    readdir: async (path: string): Promise<FileEntry[]> => {
      const names = new Set<string>();
      for (const dir of dirSet) {
        if (!dir.startsWith(`${path}/`) && !(path === '' && !dir.includes('/'))) continue;
        const rest = path === '' ? dir : dir.slice(path.length + 1);
        if (!rest) continue;
        names.add(rest.split('/')[0]!);
      }
      for (const file of Object.keys(files)) {
        if (!file.startsWith(`${path}/`) && !(path === '' && !file.includes('/'))) continue;
        const rest = path === '' ? file : file.slice(path.length + 1);
        if (!rest) continue;
        names.add(rest.split('/')[0]!);
      }
      return [...names].map(name => ({
        name,
        type: files[`${path}/${name}`] !== undefined ? ('file' as const) : ('directory' as const),
      }));
    },
    readFile: async (path: string): Promise<string> => {
      const content = files[path];
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    },
  };
}

describe('slash command loader', () => {
  beforeEach(async () => {
    vi.stubEnv('HOME', await mkdtemp(join(tmpdir(), 'mastracode-home-')));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('parses goal metadata from frontmatter', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastracode-command-'));
    const file = join(dir, 'ship.md');
    await writeFile(file, '---\nname: ship\ndescription: Ship work\ngoal: true\n---\nShip $ARGUMENTS\n');

    const command = await parseCommandFile(file, dir);

    expect(command).toMatchObject({
      name: 'ship',
      description: 'Ship work',
      goal: true,
      template: 'Ship $ARGUMENTS',
    });
  });

  it('preserves goal metadata while scanning directories', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastracode-commands-'));
    await writeFile(join(dir, 'review.md'), '---\ndescription: Review code\ngoal: true\n---\nReview the code\n');

    const commands = await scanCommandDirectory(dir);

    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ name: 'review', goal: true });
  });

  it('ignores node_modules while preserving nested commands', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'mastracode-project-'));
    const commandsDir = join(projectDir, '.mastracode', 'commands');
    const presentationDir = join(commandsDir, 'presentation');
    const dependencyDir = join(
      presentationDir,
      'node_modules',
      '.pnpm',
      'example@1.0.0',
      'node_modules',
      'dependency-readme-sentinel',
    );
    const symlinkSourceDir = join(projectDir, '.mastracode', 'command-sources', 'dependencies');
    const symlinkNamespaceDir = join(commandsDir, 'linked');
    await mkdir(presentationDir, { recursive: true });
    await mkdir(dependencyDir, { recursive: true });
    await mkdir(symlinkSourceDir, { recursive: true });
    await mkdir(symlinkNamespaceDir, { recursive: true });
    await writeFile(join(presentationDir, 'review.md'), 'Review the presentation\n');
    await writeFile(join(dependencyDir, 'README.md'), 'Dependency README\n');
    await writeFile(join(symlinkSourceDir, 'README.md'), 'Symlinked dependency README\n');
    await symlink(symlinkSourceDir, join(symlinkNamespaceDir, 'node_modules'));

    const commands = await loadCustomCommands(projectDir);

    expect(commands.find(command => command.name === 'presentation:review')).toMatchObject({
      sourcePath: join(presentationDir, 'review.md'),
    });
    expect(commands.every(command => !command.name.includes('node_modules'))).toBe(true);
    expect(commands.every(command => !command.sourcePath.split(sep).includes('node_modules'))).toBe(true);
  });

  it('loads an explicitly configured command root beneath node_modules', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'mastracode-project-'));
    const commandsDir = join(projectDir, 'node_modules', 'example-plugin', 'commands');
    await mkdir(commandsDir, { recursive: true });
    await writeFile(join(commandsDir, 'review.md'), 'Review the plugin\n');

    const commands = await loadCustomCommands(projectDir, '.mastracode', [commandsDir]);

    expect(commands.find(command => command.name === 'review')).toMatchObject({
      sourcePath: join(commandsDir, 'review.md'),
    });
  });

  it('loads individually symlinked command files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastracode-commands-'));
    const sourceDir = await mkdtemp(join(tmpdir(), 'mastracode-command-source-'));
    const sourceFile = join(sourceDir, 'review.md');
    await writeFile(sourceFile, 'Review the code\n');
    await symlink(sourceFile, join(dir, 'review.md'));

    const commands = await scanCommandDirectory(dir);

    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ name: 'review', sourcePath: join(dir, 'review.md') });
  });

  it('loads project command symlinks that stay within the project root', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'mastracode-project-'));
    const commandsDir = join(projectDir, '.mastracode', 'commands');
    const sourcesDir = join(projectDir, '.mastracode', 'command-sources');
    await mkdir(commandsDir, { recursive: true });
    await mkdir(sourcesDir, { recursive: true });
    await writeFile(join(sourcesDir, 'review.md'), 'Review the code\n');
    await symlink(join(sourcesDir, 'review.md'), join(commandsDir, 'review.md'));

    const commands = await loadCustomCommands(projectDir);

    expect(commands.find(command => command.name === 'review')).toMatchObject({
      sourcePath: join(commandsDir, 'review.md'),
    });
  });

  it('rejects project command symlinks that escape the project root', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'mastracode-project-'));
    const commandsDir = join(projectDir, '.mastracode', 'commands');
    const externalDir = await mkdtemp(join(tmpdir(), 'mastracode-command-secret-'));
    await mkdir(commandsDir, { recursive: true });
    await writeFile(join(externalDir, '.env'), 'SECRET=value\n');
    await symlink(join(externalDir, '.env'), join(commandsDir, 'leaked.md'));

    const commands = await loadCustomCommands(projectDir);

    expect(commands.find(command => command.name === 'leaked')).toBeUndefined();
  });

  it('rejects project command directories symlinked outside the project root', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'mastracode-project-'));
    const claudeDir = join(projectDir, '.claude');
    const externalCommandsDir = await mkdtemp(join(tmpdir(), 'mastracode-external-commands-'));
    await mkdir(claudeDir, { recursive: true });
    await writeFile(join(externalCommandsDir, 'leaked.md'), 'External command\n');
    await symlink(externalCommandsDir, join(claudeDir, 'commands'));

    const commands = await loadCustomCommands(projectDir);

    expect(commands.find(command => command.name === 'leaked')).toBeUndefined();
  });

  it('rejects plugin command symlinks that escape the plugin command root', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'mastracode-project-'));
    const pluginCommandsDir = await mkdtemp(join(tmpdir(), 'mastracode-plugin-commands-'));
    const externalDir = await mkdtemp(join(tmpdir(), 'mastracode-command-secret-'));
    await writeFile(join(externalDir, 'secret.txt'), 'plugin secret\n');
    await symlink(join(externalDir, 'secret.txt'), join(pluginCommandsDir, 'leaked.md'));

    const commands = await loadCustomCommands(projectDir, '.mastracode', [pluginCommandsDir]);

    expect(commands.find(command => command.name === 'leaked')).toBeUndefined();
  });

  it('ignores broken command symlinks', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastracode-commands-'));
    await symlink(join(dir, 'missing.md'), join(dir, 'broken.md'));

    await expect(scanCommandDirectory(dir)).resolves.toEqual([]);
  });

  it('loads plugin command directories after built-in custom command locations', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'mastracode-project-'));
    const pluginCommandsDir = await mkdtemp(join(tmpdir(), 'mastracode-plugin-commands-'));
    await writeFile(
      join(pluginCommandsDir, 'alexandria.md'),
      '---\ndescription: Ask Alexandria\n---\nAsk $ARGUMENTS\n',
    );

    const commands = await loadCustomCommands(projectDir, '.mastracode', [pluginCommandsDir]);

    expect(commands.find(command => command.name === 'alexandria')).toMatchObject({
      description: 'Ask Alexandria',
      sourcePath: join(pluginCommandsDir, 'alexandria.md'),
    });
  });

  it('loads global user directories in ascending precedence', async () => {
    const home = process.env.HOME!;
    await mkdir(join(home, '.opencode', 'command'), { recursive: true });
    await mkdir(join(home, '.claude', 'commands'), { recursive: true });
    await mkdir(join(home, '.mastracode', 'commands'), { recursive: true });
    await writeFile(join(home, '.opencode', 'command', 'deploy.md'), 'opencode version\n');
    await writeFile(join(home, '.claude', 'commands', 'deploy.md'), 'claude version\n');
    await writeFile(join(home, '.mastracode', 'commands', 'review.md'), 'mastra review\n');

    const commands = await loadGlobalCustomCommands('.mastracode');

    expect(commands.find(command => command.name === 'deploy')?.template).toBe('claude version\n');
    expect(commands.find(command => command.name === 'review')?.template).toBe('mastra review\n');
  });

  describe('loadWorkspaceCustomCommands', () => {
    it('merges workspace roots with config-dir precedence and colon namespaces', async () => {
      const filesystem = createFakeWorkspaceFilesystem({
        '.opencode/command/deploy.md': 'opencode deploy\n',
        '.claude/commands/deploy.md': 'claude deploy\n',
        '.mastracode/commands/deploy.md': 'mastra deploy\n',
        '.mastracode/commands/presentation/review.md': 'Review the presentation\n',
      });

      const commands = await loadWorkspaceCustomCommands(filesystem, '.mastracode');

      const deploy = commands.find(command => command.name === 'deploy');
      expect(deploy).toMatchObject({ template: 'mastra deploy\n', sourcePath: '.mastracode/commands/deploy.md' });
      expect(commands.find(command => command.name === 'presentation:review')).toMatchObject({
        sourcePath: '.mastracode/commands/presentation/review.md',
      });
    });

    it('parses frontmatter metadata from workspace files', async () => {
      const filesystem = createFakeWorkspaceFilesystem({
        '.claude/commands/ship.md': '---\nname: ship\ndescription: Ship work\ngoal: true\n---\nShip $ARGUMENTS\n',
      });

      const commands = await loadWorkspaceCustomCommands(filesystem);

      expect(commands).toEqual([expect.objectContaining({ name: 'ship', description: 'Ship work', goal: true })]);
    });

    it('treats missing roots as empty without throwing', async () => {
      const filesystem = createFakeWorkspaceFilesystem({});

      await expect(loadWorkspaceCustomCommands(filesystem)).resolves.toEqual([]);
    });

    it('skips node_modules and traversal entry names', async () => {
      const filesystem = createFakeWorkspaceFilesystem(
        {
          '.claude/commands/node_modules/sentinel/README.md': 'DEPENDENCY_SENTINEL\n',
          '.claude/commands/real.md': 'Real command\n',
        },
        ['.claude/commands/node_modules'],
      );

      const commands = await loadWorkspaceCustomCommands(filesystem);

      expect(commands.map(command => command.name)).toEqual(['real']);
    });

    it('never reads entries whose names contain traversal segments', async () => {
      const readFile = vi.fn(async () => 'SECRET\n');
      const filesystem = {
        exists: async () => true,
        readdir: async () =>
          [
            { name: '../escape.md', type: 'file' },
            { name: '..', type: 'directory' },
          ] as FileEntry[],
        readFile,
      };

      await expect(loadWorkspaceCustomCommands(filesystem)).resolves.toEqual([]);
      expect(readFile).not.toHaveBeenCalled();
    });

    it('propagates unexpected read errors', async () => {
      const filesystem = createFakeWorkspaceFilesystem({
        '.claude/commands/broken.md': '---\nbroken',
      });
      filesystem.readFile = async () => {
        throw new Error('EACCES: permission denied');
      };

      await expect(loadWorkspaceCustomCommands(filesystem)).rejects.toThrow('EACCES');
    });
  });
});
