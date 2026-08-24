import { describe, it, expect } from 'vitest';

import type { SlashCommandDescriptor } from '../../../factory-ui/src/ui/domains/chat/services/commands';
import { matchCommands } from '../../../factory-ui/src/ui/domains/chat/services/commands';

const COMMANDS: SlashCommandDescriptor[] = [
  { name: 'model', description: 'Switch model', requiresSession: true },
  { name: 'goal', description: 'Set a goal', requiresSession: true },
  { name: 'goal-clear', description: 'Clear a goal', requiresSession: true },
  { name: 'mode', description: 'Switch mode', requiresSession: true },
  { name: 'yolo', description: 'Enable yolo', requiresSession: true },
];

/**
 * Slash-command autocomplete is pure client logic: given the composer draft,
 * `matchCommands` decides which commands to suggest. Test it directly.
 */
describe('slash-command autocomplete', () => {
  it('suggests nothing for plain (non-slash) text', () => {
    expect(matchCommands(COMMANDS, 'hello world')).toEqual([]);
    expect(matchCommands(COMMANDS, '')).toEqual([]);
  });

  it('suggests the full list right after typing "/"', () => {
    expect(matchCommands(COMMANDS, '/')).toEqual(COMMANDS);
  });

  it('narrows by prefix as the command name is typed', () => {
    const names = matchCommands(COMMANDS, '/go').map(command => command.name);
    expect(names).toContain('goal');
    expect(names).toContain('goal-clear');
    expect(names).not.toContain('mode');
  });

  it('is case-insensitive', () => {
    expect(matchCommands(COMMANDS, '/MO').map(command => command.name)).toEqual(
      matchCommands(COMMANDS, '/mo').map(command => command.name),
    );
    expect(matchCommands(COMMANDS, '/MODEL').map(command => command.name)).toContain('model');
  });

  it('matches an exact command name (single result enables Enter-to-run)', () => {
    const matches = matchCommands(COMMANDS, '/yolo');
    expect(matches.map(c => c.name)).toEqual(['yolo']);
  });

  it('stops suggesting once the user starts typing arguments', () => {
    expect(matchCommands(COMMANDS, '/model ')).toEqual([]);
    expect(matchCommands(COMMANDS, '/model gpt')).toEqual([]);
  });

  it('returns an empty list for an unknown command prefix', () => {
    expect(matchCommands(COMMANDS, '/zzz')).toEqual([]);
  });
});
