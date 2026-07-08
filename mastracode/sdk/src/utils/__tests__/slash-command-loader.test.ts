import { mkdtemp, writeFile } from 'node:fs/promises';
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
