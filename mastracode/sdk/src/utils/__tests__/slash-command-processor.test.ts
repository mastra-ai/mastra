import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { SlashCommandMetadata } from '../slash-command-loader.js';
import {
  createNodeSlashCommandProcessingContext,
  formatSlashCommandActivation,
  processSlashCommandWithContext,
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

    const result = await processSlashCommandWithContext(
      createCommand('Read @context.md'),
      [],
      createNodeSlashCommandProcessingContext(dir),
    );

    expect(result).toBe('Read File context');
  });

  it('leaves @ references intact when they do not resolve to files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastracode-command-processor-'));

    const result = await processSlashCommandWithContext(
      createCommand('gh search prs --involves @me --search "involves:@me sort:updated-asc"'),
      [],
      createNodeSlashCommandProcessingContext(dir),
    );

    expect(result).toBe('gh search prs --involves @me --search "involves:@me sort:updated-asc"');
  });

  it('appends unused raw arguments when a custom command has no argument placeholders', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastracode-command-processor-'));

    const result = await processSlashCommandWithContext(
      createCommand('Deploy using the standard checklist.'),
      ['prod', 'blue'],
      createNodeSlashCommandProcessingContext(dir),
    );

    expect(result).toBe('Deploy using the standard checklist.\n\nARGUMENTS: prod blue');
  });

  it('does not append raw arguments when explicit placeholders consume them', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastracode-command-processor-'));
    const context = createNodeSlashCommandProcessingContext(dir);

    await expect(
      processSlashCommandWithContext(createCommand('Review $ARGUMENTS'), ['src/index.ts'], context),
    ).resolves.toBe('Review src/index.ts');
    await expect(
      processSlashCommandWithContext(createCommand('Compare $1 with $2'), ['before', 'after'], context),
    ).resolves.toBe('Compare before with after');
    await expect(
      processSlashCommandWithContext(createCommand('Review $1+'), ['src/index.ts', 'src/main.ts'], context),
    ).resolves.toBe('Review src/index.ts src/main.ts');
  });

  it('treats $0 as literal shell text instead of a positional placeholder', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastracode-command-processor-'));

    const result = await processSlashCommandWithContext(
      createCommand('Explain why `echo $0` prints the shell name.'),
      ['zsh'],
      createNodeSlashCommandProcessingContext(dir),
    );

    expect(result).toBe('Explain why `echo $0` prints the shell name.\n\nARGUMENTS: zsh');
  });

  it('substitutes successful shell commands through the injected context', async () => {
    const result = await processSlashCommandWithContext(createCommand('Branch: !`echo main`'), [], {
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
    const result = await processSlashCommandWithContext(createCommand(template), [], failingContext);

    expect(result).toBe('Out: [Error: Failed to execute "fail-hard"] and [Error: Failed to execute "also-fail"]');
  });

  it('never lets arguments introduce shell or file directives', async () => {
    let executedCommands: string[] = [];
    let readPaths: string[] = [];
    const context = {
      readFile: async (filePath: string) => {
        readPaths.push(filePath);
        return 'SECRET ENV CONTENT';
      },
      executeShell: async (command: string) => {
        executedCommands.push(command);
        return { success: true, stdout: 'PWNED' };
      },
    };

    const result = await processSlashCommandWithContext(
      createCommand('Deploy $ARGUMENTS now'),
      ['!`env`', '@.env'],
      context,
    );

    expect(result).toContain('!`env`');
    expect(result).toContain('@.env');
    expect(result).not.toContain('SECRET ENV CONTENT');
    expect(executedCommands).toEqual([]);
    expect(readPaths).toEqual([]);

    void result;
  });

  it('quotes argument values substituted into an original shell directive', async () => {
    const executed: string[] = [];
    const context = {
      readFile: async () => undefined,
      executeShell: async (command: string) => {
        executed.push(command);
        return { success: true, stdout: command };
      },
    };

    const result = await processSlashCommandWithContext(
      createCommand("Diff: !`printf '%s' $1`"),
      ["it's a test"],
      context,
    );

    expect(executed).toEqual(["printf '%s' 'it'\\''s a test'"]);
    expect(result).toBe(`Diff: ${executed[0]}`);
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
