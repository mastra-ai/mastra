import { describe, expect, it } from 'vitest';

import type { SlashCommandDescriptor } from '../commands';
import { commandRequiresReadySession, matchCommands, parseSlashCommand } from '../commands';

const COMMANDS: SlashCommandDescriptor[] = [
  { name: 'model', description: 'Switch model', requiresSession: true },
  { name: 'goal', description: 'Set a goal', requiresSession: true },
  { name: 'goal-clear', description: 'Clear a goal', requiresSession: true },
  { name: 'help', description: 'Show help', requiresSession: false },
];

describe('slash command parsing', () => {
  it('returns no suggestions for plain text', () => {
    expect(matchCommands(COMMANDS, 'hello')).toEqual([]);
  });

  it('returns every provided command for a slash', () => {
    expect(matchCommands(COMMANDS, '/')).toEqual(COMMANDS);
  });

  it('narrows suggestions by command prefix', () => {
    expect(matchCommands(COMMANDS, '/go').map(command => command.name)).toEqual(['goal', 'goal-clear']);
  });

  it('stops suggesting after arguments begin', () => {
    expect(matchCommands(COMMANDS, '/model openai/gpt-4o')).toEqual([]);
  });

  it('preserves the raw command argument string', () => {
    expect(parseSlashCommand('/goal ship this refactor')).toEqual({
      name: 'goal',
      rawArguments: 'ship this refactor',
    });
  });

  it('derives session gating from the provided registry', () => {
    expect(commandRequiresReadySession(COMMANDS, '/goal ship it')).toBe(true);
    expect(commandRequiresReadySession(COMMANDS, '/help')).toBe(false);
  });
});
