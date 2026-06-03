import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { SlashCommandMetadata } from '../slash-command-loader.js';
import { processSlashCommand } from '../slash-command-processor.js';

const createCommand = (template: string): SlashCommandMetadata => ({
  name: 'test',
  description: 'Test command',
  template,
  sourcePath: '/tmp/test.md',
});

describe('slash command processor', () => {
  it('replaces file references that resolve on disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastracode-command-processor-'));
    await writeFile(join(dir, 'context.md'), 'File context');

    const result = await processSlashCommand(createCommand('Read @context.md'), [], dir);

    expect(result).toBe('Read File context');
  });

  it('leaves @ references intact when they do not resolve to files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastracode-command-processor-'));

    const result = await processSlashCommand(
      createCommand('gh search prs --involves @me --search "involves:@me sort:updated-asc"'),
      [],
      dir,
    );

    expect(result).toBe('gh search prs --involves @me --search "involves:@me sort:updated-asc"');
  });
});
