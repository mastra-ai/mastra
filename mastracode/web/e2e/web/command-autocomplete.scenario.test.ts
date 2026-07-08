import { describe, it, expect } from 'vitest';

import { matchCommands, SLASH_COMMANDS } from '../../src/web/ui/domains/chat/services/commands';

/**
 * Slash-command autocomplete is pure client logic: given the composer draft,
 * `matchCommands` decides which commands to suggest. Test it directly.
 */
describe('slash-command autocomplete', () => {
  it('suggests nothing for plain (non-slash) text', () => {
    expect(matchCommands('hello world')).toEqual([]);
    expect(matchCommands('')).toEqual([]);
  });

  it('suggests the full list right after typing "/"', () => {
    expect(matchCommands('/')).toEqual(SLASH_COMMANDS);
  });

  it('narrows by prefix as the command name is typed', () => {
    const names = matchCommands('/go').map(c => c.name);
    expect(names).toContain('goal');
    expect(names).toContain('goal-clear');
    expect(names).not.toContain('mode');
  });

  it('is case-insensitive', () => {
    expect(matchCommands('/MO').map(c => c.name)).toEqual(matchCommands('/mo').map(c => c.name));
    expect(matchCommands('/MODEL').map(c => c.name)).toContain('model');
  });

  it('matches an exact command name (single result enables Enter-to-run)', () => {
    const matches = matchCommands('/yolo');
    expect(matches.map(c => c.name)).toEqual(['yolo']);
  });

  it('stops suggesting once the user starts typing arguments', () => {
    expect(matchCommands('/model ')).toEqual([]);
    expect(matchCommands('/model gpt')).toEqual([]);
  });

  it('returns an empty list for an unknown command prefix', () => {
    expect(matchCommands('/zzz')).toEqual([]);
  });
});
