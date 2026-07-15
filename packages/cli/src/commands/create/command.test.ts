import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

import { configureCreateCommand, normalizeCreateCommandOptions, selectMatchingDistTag } from './create';

type CreateCommandOptions = Parameters<typeof normalizeCreateCommandOptions>[1];
type NormalizedCreateOptions = ReturnType<typeof normalizeCreateCommandOptions>;

function quiet(command: Command): Command {
  return command.exitOverride().configureOutput({
    writeOut: () => {},
    writeErr: () => {},
  });
}

function createRoot(onAction: (options: NormalizedCreateOptions) => void): Command {
  const command = configureCreateCommand(quiet(new Command().name('create-mastra')));
  command.action((projectName: string | undefined, options: CreateCommandOptions) => {
    onAction(normalizeCreateCommandOptions(projectName, options));
  });
  return command;
}

function createSubcommand(onAction: (options: NormalizedCreateOptions) => void): Command {
  const program = quiet(new Command().name('mastra'));
  const command = configureCreateCommand(program.command('create'));
  command.action((projectName: string | undefined, options: CreateCommandOptions) => {
    onAction(normalizeCreateCommandOptions(projectName, options));
  });
  return program;
}

async function parseRoot(args: string[], onAction = vi.fn()) {
  const command = createRoot(onAction);
  await command.parseAsync(['node', 'create-mastra', ...args]);
  return { command, onAction };
}

async function parseSubcommand(args: string[], onAction = vi.fn()) {
  const program = createSubcommand(onAction);
  await program.parseAsync(['node', 'mastra', 'create', ...args]);
  return { program, command: program.commands[0]!, onAction };
}

const EXPECTED_OPTIONS = [
  { short: undefined, long: '--yes' },
  { short: undefined, long: '--empty' },
  { short: '-l', long: '--llm' },
  { short: '-k', long: '--llm-api-key' },
  { short: undefined, long: '--no-skills' },
  { short: undefined, long: '--no-git' },
  { short: '-t', long: '--template' },
  { short: undefined, long: '--timeout' },
];

const REMOVED_OPTIONS = [
  '--project-name',
  '-p',
  '--default',
  '--dir',
  '-d',
  '--components',
  '-c',
  '--example',
  '-e',
  '--no-example',
  '--mcp',
  '-m',
  '--skills',
  '--observe',
  '--no-observe',
  '--observability',
  '--no-observability',
  '--observability-project',
];

describe('shared create Commander contract', () => {
  it.each([
    ['standalone', () => createRoot(vi.fn())],
    ['subcommand', () => createSubcommand(vi.fn()).commands[0]!],
  ])('exposes the exact approved option inventory for the %s shape', (_name, build) => {
    const command = build();

    expect(command.options.map(option => ({ short: option.short, long: option.long }))).toEqual(EXPECTED_OPTIONS);
    expect(command.registeredArguments.map(argument => argument.name())).toEqual(['project-name']);
  });

  it.each(REMOVED_OPTIONS)('rejects removed option or alias %s in both command shapes', async option => {
    await expect(parseRoot([option])).rejects.toMatchObject({ code: 'commander.unknownOption' });
    await expect(parseSubcommand([option])).rejects.toMatchObject({ code: 'commander.unknownOption' });
  });

  it('uses a required positive-integer timeout with a 60,000 ms default', async () => {
    const rootDefault = vi.fn();
    const subDefault = vi.fn();
    await parseRoot(['project'], rootDefault);
    await parseSubcommand(['project'], subDefault);

    expect(rootDefault).toHaveBeenCalledWith(expect.objectContaining({ timeout: 60_000 }));
    expect(subDefault).toHaveBeenCalledWith(expect.objectContaining({ timeout: 60_000 }));

    await expect(parseRoot(['project', '--timeout'])).rejects.toMatchObject({
      code: 'commander.optionMissingArgument',
    });
    await expect(parseRoot(['project', '--timeout', '0'])).rejects.toMatchObject({ code: 'commander.invalidArgument' });
    await expect(parseRoot(['project', '--timeout', '-1'])).rejects.toMatchObject({
      code: 'commander.invalidArgument',
    });
    await expect(parseRoot(['project', '--timeout', '1.5'])).rejects.toMatchObject({
      code: 'commander.invalidArgument',
    });
    await expect(parseRoot(['project', '--timeout', 'abc'])).rejects.toMatchObject({
      code: 'commander.invalidArgument',
    });
  });

  it('parses negated skills and git options to false in both shapes', async () => {
    const rootAction = vi.fn();
    const subAction = vi.fn();
    await parseRoot(['project', '--no-skills', '--no-git'], rootAction);
    await parseSubcommand(['project', '--no-skills', '--no-git'], subAction);

    expect(rootAction).toHaveBeenCalledWith(expect.objectContaining({ skills: false, git: false }));
    expect(subAction).toHaveBeenCalledWith(expect.objectContaining({ skills: false, git: false }));
  });

  it('defaults skills and git to true in both shapes', async () => {
    const rootAction = vi.fn();
    const subAction = vi.fn();
    await parseRoot(['project'], rootAction);
    await parseSubcommand(['project'], subAction);

    expect(rootAction).toHaveBeenCalledWith(expect.objectContaining({ skills: true, git: true }));
    expect(subAction).toHaveBeenCalledWith(expect.objectContaining({ skills: true, git: true }));
  });

  it.each(['openai', 'anthropic', 'google', 'xai'])('shares provider parsing for %s', async provider => {
    const rootAction = vi.fn();
    const subAction = vi.fn();
    await parseRoot(['project', '--llm', provider], rootAction);
    await parseSubcommand(['project', '--llm', provider], subAction);

    expect(rootAction).toHaveBeenCalledWith(expect.objectContaining({ llmProvider: provider }));
    expect(subAction).toHaveBeenCalledWith(expect.objectContaining({ llmProvider: provider }));
  });

  it('rejects providers outside the create-specific provider set', async () => {
    await expect(parseRoot(['project', '--llm', 'groq'])).rejects.toMatchObject({ code: 'commander.invalidArgument' });
    await expect(parseSubcommand(['project', '--llm', 'mistral'])).rejects.toMatchObject({
      code: 'commander.invalidArgument',
    });
  });

  it('normalizes equivalent standalone and subcommand arguments identically', async () => {
    const rootAction = vi.fn();
    const subAction = vi.fn();
    const args = [
      'project',
      '--yes',
      '--llm',
      'anthropic',
      '--llm-api-key',
      'secret',
      '--no-skills',
      '--no-git',
      '--timeout',
      '12345',
    ];

    await parseRoot(args, rootAction);
    await parseSubcommand(args, subAction);

    expect(rootAction.mock.calls[0]?.[0]).toEqual(subAction.mock.calls[0]?.[0]);
  });
});

describe('release-channel tag selection', () => {
  it('prefers the first nonnumeric prerelease identifier when duplicate tags match', () => {
    expect(
      selectMatchingDistTag(
        '1.2.3-create-mastra-e2e-test.4',
        'latest: 1.2.3-create-mastra-e2e-test.4\nbeta: 1.2.3-create-mastra-e2e-test.4\ncreate-mastra-e2e-test: 1.2.3-create-mastra-e2e-test.4',
      ),
    ).toBe('create-mastra-e2e-test');
  });

  it('matches changesets snapshot tags before latest', () => {
    const version = '0.0.0-create-mastra-e2e-test-20260715172042';
    expect(selectMatchingDistTag(version, `latest: ${version}\ncreate-mastra-e2e-test: ${version}`)).toBe(
      'create-mastra-e2e-test',
    );
  });

  it('falls back deterministically through latest, beta, then lexical order', () => {
    expect(selectMatchingDistTag('1.0.0', 'zeta: 1.0.0\nbeta: 1.0.0\nlatest: 1.0.0')).toBe('latest');
    expect(selectMatchingDistTag('1.0.0', 'zeta: 1.0.0\nbeta: 1.0.0')).toBe('beta');
    expect(selectMatchingDistTag('1.0.0', 'zeta: 1.0.0\nalpha: 1.0.0')).toBe('alpha');
  });

  it('matches exact wrapper versions and ignores different concrete Mastra package versions', () => {
    expect(
      selectMatchingDistTag(
        '1.2.3-snapshot.1',
        'snapshot: 9.9.9-snapshot.1\nlatest: 1.2.3\nsnapshot: 1.2.3-snapshot.1',
      ),
    ).toBe('snapshot');
  });

  it('returns undefined when no tag exactly matches the wrapper version', () => {
    expect(selectMatchingDistTag('1.0.0', 'latest: 1.0.1\nbeta: 1.0.0-beta.1')).toBeUndefined();
  });
});
