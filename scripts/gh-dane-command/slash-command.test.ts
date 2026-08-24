import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Same source path the script imports, so a breaking change to the published
// slash-command API fails here before GitHub Actions does.
import { processSlashCommand } from '../../mastracode/sdk/src/utils/slash-command-processor.js';
import type { SlashCommandMetadata } from '../../mastracode/sdk/src/utils/slash-command-loader.js';

const command = (template: string): SlashCommandMetadata => ({
  name: 'gh-command',
  description: '',
  template,
  sourcePath: 'template.md',
});

describe('gh-dane-command template expansion', () => {
  it('keeps the published working-directory signature', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gh-dane-command-'));
    await writeFile(join(dir, 'context.md'), 'PR context');

    const result = await processSlashCommand(command('Read @context.md for $1'), ['42'], dir);

    expect(result).toBe('Read PR context for 42');
  });

  it('executes an original shell directive once with the argument safely quoted', async () => {
    const result = await processSlashCommand(command("Diff: !`printf '%s' $1`"), ['a b'], process.cwd());

    expect(result).toBe('Diff: a b');
  });

  it('never executes or reads directives that arrive through arguments', async () => {
    const result = await processSlashCommand(
      command('Deploy $ARGUMENTS now'),
      ['!`echo pwned`', '@.env'],
      process.cwd(),
    );

    expect(result).toContain('!`echo pwned`');
    expect(result).toContain('@.env');
    expect(result).not.toContain('pwned\n');
    expect(result).not.toMatch(/^PATH=/m);
    expect(result).not.toContain('ARGUMENTS: !`'); // raw append must not double the injection either
  });
});
