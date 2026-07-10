import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadCustomCommands, parseCommandFile, scanCommandDirectory } from '../slash-command-loader.js';

describe('slash command loader', () => {
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
});
