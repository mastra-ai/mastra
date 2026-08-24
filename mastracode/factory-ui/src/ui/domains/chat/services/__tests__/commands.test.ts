import { describe, expect, it } from 'vitest';

import type { ResolvedChatCommand } from '../commands';
import { findCommand, matchCommands, parseCommandInput, resolveCommandToken } from '../commands';

function makeCommand(invocation: string, overrides: Partial<ResolvedChatCommand> = {}): ResolvedChatCommand {
  return {
    id: invocation,
    invocation,
    description: `Description for ${invocation}`,
    availability: { state: 'available' },
    execute: async () => {},
    ...overrides,
  };
}

const REGISTRY = [
  makeCommand('/goal', {
    argumentHint: '<objective|status|pause|resume|clear>',
    completeArguments: ['status', 'pause', 'resume', 'clear'],
  }),
  makeCommand('/models'),
  makeCommand('/mode', { argumentHint: '<id>' }),
  makeCommand('//deploy', { description: 'Custom deploy command' }),
  makeCommand('/skill/understand-pr'),
  makeCommand('/goal/deploy'),
];

describe('parseCommandInput', () => {
  it('given non-command text, then no command token is parsed', () => {
    expect(parseCommandInput('hello world')).toEqual({ rawArguments: '', hasArguments: false });
  });

  it('parses // before / and preserves the raw argument string verbatim', () => {
    expect(parseCommandInput('//deploy   prod blue')).toEqual({
      command: '//deploy',
      rawArguments: 'prod blue',
      hasArguments: true,
    });
  });

  it('keeps runtime tokens containing slashes intact as the command token', () => {
    expect(parseCommandInput('/skill/understand-pr PR 12')).toEqual({
      command: '/skill/understand-pr',
      rawArguments: 'PR 12',
      hasArguments: true,
    });
  });

  it('treats a bare slash as a command with no arguments', () => {
    expect(parseCommandInput('/')).toEqual({ command: '/', rawArguments: '', hasArguments: false });
  });

  it('enters the args phase on a single trailing space so suggestions close', () => {
    const parsed = parseCommandInput('/goal ');
    expect(parsed).toMatchObject({ command: '/goal', rawArguments: '', hasArguments: true });
    expect(matchCommands(REGISTRY, '/goal ')).toEqual([]);
  });
});

describe('matchCommands', () => {
  it('returns the full registry for a lone slash', () => {
    expect(matchCommands(REGISTRY, '/')).toEqual(REGISTRY);
  });

  it('narrows by prefix across built-ins and runtime tokens', () => {
    expect(matchCommands(REGISTRY, '/go').map(command => command.invocation)).toEqual(['/goal', '/goal/deploy']);
    expect(matchCommands(REGISTRY, '/skill/und').map(command => command.invocation)).toEqual(['/skill/understand-pr']);
  });

  it('stops suggesting once arguments are being typed', () => {
    expect(matchCommands(REGISTRY, '/model openai/gpt-4o')).toEqual([]);
  });
});

describe('findCommand', () => {
  it('matches exact invocations only', () => {
    expect(findCommand(REGISTRY, '/models')?.invocation).toBe('/models');
    expect(findCommand(REGISTRY, '/mod')?.invocation).toBeUndefined();
  });

  it('distinguishes /goal from the /goal/<name> goal source', () => {
    expect(findCommand(REGISTRY, '/goal/deploy')?.invocation).toBe('/goal/deploy');
    expect(findCommand(REGISTRY, '/goal/deploy extra')?.invocation).toBe('/goal/deploy');
  });

  it('resolves exact tokens and falls back /name to the canonical //name', () => {
    expect(resolveCommandToken(REGISTRY, '//deploy now')?.invocation).toBe('//deploy');
    // No explicit custom named "models" exists — no fallback happens.
    expect(resolveCommandToken(REGISTRY, '/models')?.invocation).toBe('/models');
    const fallback = resolveCommandToken([makeCommand('//review')], '/review args');
    expect(fallback?.invocation).toBe('//review');
    expect(resolveCommandToken(REGISTRY, 'plain text')).toBeUndefined();
  });
});
