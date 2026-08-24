import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { SlashCommandMetadata } from '../slash-command-loader.js';
import {
  createNodeSlashCommandProcessingContext,
  formatSlashCommandActivation,
  processSlashCommand,
} from '../slash-command-processor.js';

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

    const result = await processSlashCommand(
      createCommand('Read @context.md'),
      [],
      createNodeSlashCommandProcessingContext(dir),
    );

    expect(result).toBe('Read File context');
  });

  it('leaves @ references intact when they do not resolve to files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastracode-command-processor-'));

    const result = await processSlashCommand(
      createCommand('gh search prs --involves @me --search "involves:@me sort:updated-asc"'),
      [],
      createNodeSlashCommandProcessingContext(dir),
    );

    expect(result).toBe('gh search prs --involves @me --search "involves:@me sort:updated-asc"');
  });

  it('appends unused raw arguments when a custom command has no argument placeholders', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastracode-command-processor-'));

    const result = await processSlashCommand(
      createCommand('Deploy using the standard checklist.'),
      ['prod', 'blue'],
      createNodeSlashCommandProcessingContext(dir),
    );

    expect(result).toBe('Deploy using the standard checklist.\n\nARGUMENTS: prod blue');
  });

  it('does not append raw arguments when explicit placeholders consume them', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastracode-command-processor-'));
    const context = createNodeSlashCommandProcessingContext(dir);

    await expect(processSlashCommand(createCommand('Review $ARGUMENTS'), ['src/index.ts'], context)).resolves.toBe(
      'Review src/index.ts',
    );
    await expect(processSlashCommand(createCommand('Compare $1 with $2'), ['before', 'after'], context)).resolves.toBe(
      'Compare before with after',
    );
    await expect(
      processSlashCommand(createCommand('Review $1+'), ['src/index.ts', 'src/main.ts'], context),
    ).resolves.toBe('Review src/index.ts src/main.ts');
  });

  it('treats $0 as literal shell text instead of a positional placeholder', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastracode-command-processor-'));

    const result = await processSlashCommand(
      createCommand('Explain why `echo $0` prints the shell name.'),
      ['zsh'],
      createNodeSlashCommandProcessingContext(dir),
    );

    expect(result).toBe('Explain why `echo $0` prints the shell name.\n\nARGUMENTS: zsh');
  });

  it('substitutes successful shell commands through the injected context', async () => {
    const result = await processSlashCommand(createCommand('Branch: !`echo main`'), [], {
      readFile: async () => undefined,
      executeShell: async () => ({ success: true, stdout: 'main\n' }),
    });

    expect(result).toBe('Branch: main');
  });

  it('marks failed or throwing shell substitutions without executing them on the host', async () => {
    const template = 'Out: !`fail-hard` and !`also-fail`';

    const failingContext = {
      readFile: async () => undefined,
      executeShell: async (command: string) => {
        if (command === 'fail-hard') return { success: false, stdout: '' };
        throw new Error('sandbox gone');
      },
    };
    const result = await processSlashCommand(createCommand(template), [], failingContext);

    expect(result).toBe('Out: [Error: Failed to execute "fail-hard"] and [Error: Failed to execute "also-fail"]');
  });

  it('formats activation envelopes and escapes literal closing boundaries', () => {
    expect(formatSlashCommandActivation('deploy', 'Ship it')).toBe(
      '<slash-command name="deploy">\nShip it\n</slash-command>',
    );
    expect(formatSlashCommandActivation('deploy', 'Use </slash-command> carefully')).toBe(
      '<slash-command name="deploy">\nUse &lt;/slash-command&gt; carefully\n</slash-command>',
    );
  });
});
