import { describe, expect, it } from 'vitest';

import type { SlashCommandDescriptor } from '../commands';
import { commandRequiresReadySession, matchCommands, parseSlashCommand } from '../commands';

const COMMANDS: SlashCommandDescriptor[] = [
  { name: 'model', description: 'Switch model', requiresSession: true },
  { name: 'goal', description: 'Set a goal', requiresSession: true },
  { name: 'goal-clear', description: 'Clear a goal', requiresSession: true },
  { name: 'help', description: 'Show help', requiresSession: false },
  { name: 'mode', description: 'Switch mode', requiresSession: true },
  { name: 'yolo', description: 'Enable yolo', requiresSession: true },
];

describe('slash command parsing', () => {
  it('returns no suggestions for plain text', () => {
    expect(matchCommands(COMMANDS, 'hello')).toEqual([]);
    expect(matchCommands(COMMANDS, '')).toEqual([]);
  });

  it('returns every provided command for a slash', () => {
    expect(matchCommands(COMMANDS, '/')).toEqual(COMMANDS);
  });

  it('narrows suggestions by command prefix', () => {
    expect(matchCommands(COMMANDS, '/go').map(command => command.name)).toEqual(['goal', 'goal-clear']);
  });

  it('matches case-insensitively', () => {
    expect(matchCommands(COMMANDS, '/MO').map(command => command.name)).toEqual(
      matchCommands(COMMANDS, '/mo').map(command => command.name),
    );
    expect(matchCommands(COMMANDS, '/MODEL').map(command => command.name)).toContain('model');
  });

  it('returns one result for an exact command name', () => {
    expect(matchCommands(COMMANDS, '/yolo').map(command => command.name)).toEqual(['yolo']);
  });

  it('returns no suggestions for an unknown command prefix', () => {
    expect(matchCommands(COMMANDS, '/zzz')).toEqual([]);
  });

  it('stops suggesting after arguments begin', () => {
    expect(matchCommands(COMMANDS, '/model ')).toEqual([]);
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
