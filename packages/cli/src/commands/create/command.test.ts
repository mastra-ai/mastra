import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';
import {
  configureCreateCommand,
  normalizeCreateCommandOptions,
  parseCreateLLMProvider,
  parseCreateTimeout,
  selectMatchingDistTag,
  validateCreateOptionConflicts,
  validateProjectName,
} from './create';

type CreateCommandOptions = Parameters<typeof normalizeCreateCommandOptions>[1];
type NormalizedCreateOptions = ReturnType<typeof normalizeCreateCommandOptions>;

function createOptions(overrides: Partial<NormalizedCreateOptions> = {}): NormalizedCreateOptions {
  return {
    projectName: 'project',
    empty: false,
    llmProvider: undefined,
    llmApiKey: undefined,
    skills: true,
    git: true,
    template: undefined,
    timeout: 60_000,
    ...overrides,
  };
}

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

describe('create option parsing', () => {
  it('rejects providers outside the create-specific provider set', () => {
    expect(() => parseCreateLLMProvider('groq')).toThrow('Choose a valid provider: openai, anthropic, google, xai');
  });

  it.each([
    ['1', 1],
    ['60000', 60_000],
    [String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
  ])('parses the positive safe-integer timeout %s', (value, expected) => {
    expect(parseCreateTimeout(value)).toBe(expected);
  });

  it.each(['0', '-1', '1.5', 'abc', String(Number.MAX_SAFE_INTEGER + 1)])('rejects the invalid timeout %s', value => {
    expect(() => parseCreateTimeout(value)).toThrow('Timeout must be a positive integer');
  });
});

describe('create option validation', () => {
  it.each<{ overrides: Partial<NormalizedCreateOptions>; message: string }>([
    {
      overrides: { empty: true, template: 'agent-harness' },
      message: `The --empty and --template options can't be used together`,
    },
    {
      overrides: { empty: true, llmProvider: 'openai' },
      message: 'The --llm option can only be used with the default template',
    },
    {
      overrides: { empty: true, llmApiKey: 'secret' },
      message: 'The --llm-api-key option can only be used with the default template',
    },
    {
      overrides: { template: 'agent-harness', llmProvider: 'openai' },
      message: 'The --llm option can only be used with the default template',
    },
    {
      overrides: { template: 'agent-harness', llmApiKey: 'secret' },
      message: 'The --llm-api-key option can only be used with the default template',
    },
  ])('rejects $message', ({ overrides, message }) => {
    expect(() => validateCreateOptionConflicts(createOptions(overrides))).toThrow(message);
  });

  it.each([
    '',
    '   ',
    '.',
    '..',
    '../project',
    'project/name',
    'project\\name',
    '/absolute',
    '@scope/project',
    'Uppercase',
    'has space',
    'trailing.',
    'con',
    'CON.txt',
    'prn',
    'aux',
    'nul',
    'com1',
    'com9.log',
    'lpt1',
    'lpt9.txt',
  ])('rejects unsafe project name %j', projectName => {
    expect(() => validateProjectName(projectName)).toThrow('Project name must be');
  });

  it('trims valid project names', () => {
    expect(validateProjectName('  valid-project  ')).toBe('valid-project');
  });

  it('accepts a 214-character project name', () => {
    const projectName = `a${'b'.repeat(213)}`;
    expect(validateProjectName(projectName)).toBe(projectName);
  });
});

describe('shared create Commander wiring', () => {
  it('applies the create defaults', async () => {
    const action = vi.fn();
    await parseRoot(['project'], action);

    expect(action).toHaveBeenCalledWith({
      projectName: 'project',
      empty: false,
      llmProvider: undefined,
      llmApiKey: undefined,
      skills: true,
      git: true,
      template: undefined,
      timeout: 60_000,
    });
  });

  it('normalizes equivalent standalone and subcommand arguments identically', async () => {
    const rootAction = vi.fn();
    const subAction = vi.fn();
    const args = [
      'project',
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

    expect(rootAction.mock.calls[0]?.[0]).toEqual({
      projectName: 'project',
      empty: false,
      llmProvider: 'anthropic',
      llmApiKey: 'secret',
      skills: false,
      git: false,
      template: undefined,
      timeout: 12_345,
    });
    expect(subAction.mock.calls[0]?.[0]).toEqual(rootAction.mock.calls[0]?.[0]);
  });
});

describe('release-channel tag selection', () => {
  it.each([
    {
      name: 'matching prerelease channel',
      version: '1.2.3-beta.4',
      output: 'latest: 1.2.3-beta.4\nbeta: 1.2.3-beta.4',
      expected: 'beta',
    },
    {
      name: 'first nonnumeric prerelease identifier',
      version: '1.2.3-20260716.snapshot.1',
      output: 'latest: 1.2.3-20260716.snapshot.1\nsnapshot: 1.2.3-20260716.snapshot.1',
      expected: 'snapshot',
    },
    {
      name: 'changesets snapshot channel',
      version: '0.0.0-create-mastra-e2e-test-20260715172042',
      output:
        'latest: 0.0.0-create-mastra-e2e-test-20260715172042\ncreate-mastra-e2e-test: 0.0.0-create-mastra-e2e-test-20260715172042',
      expected: 'create-mastra-e2e-test',
    },
    {
      name: 'latest stable tag',
      version: '1.2.3',
      output: 'beta: 1.2.3\nlatest: 1.2.3',
      expected: 'latest',
    },
    {
      name: 'beta fallback',
      version: '1.2.3',
      output: 'zeta: 1.2.3\nbeta: 1.2.3',
      expected: 'beta',
    },
    {
      name: 'deterministic lexical fallback',
      version: '1.2.3',
      output: 'next: 1.2.3\nalpha: 1.2.3',
      expected: 'alpha',
    },
    {
      name: 'exact wrapper version while ignoring other versions',
      version: '1.2.3-snapshot.1',
      output: 'snapshot: 9.9.9-snapshot.1\nlatest: 1.2.3\nsnapshot: 1.2.3-snapshot.1',
      expected: 'snapshot',
    },
  ])('selects the $name', ({ version, output, expected }) => {
    expect(selectMatchingDistTag(version, output)).toBe(expected);
  });

  it('returns undefined when no tag exactly matches the wrapper version', () => {
    expect(selectMatchingDistTag('1.2.3', 'latest: 1.2.4\nbeta: 1.2.3-beta.1')).toBeUndefined();
  });
});
