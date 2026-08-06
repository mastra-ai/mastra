import { describe, expect, it } from 'vitest';

import { matchCommands, SLASH_COMMANDS } from '../commands';

describe('matchCommands', () => {
  it('given a non-command draft, then it returns no suggestions', () => {
    expect(matchCommands('hello')).toEqual([]);
  });

  it('given only a slash, then it returns the full slash-command registry', () => {
    expect(matchCommands('/')).toEqual(SLASH_COMMANDS);
  });

  it('given a command prefix, then it narrows suggestions by command name', () => {
    expect(matchCommands('/go').map(command => command.name)).toEqual([
      'goal',
      'goal-clear',
      'goal-pause',
      'goal-resume',
    ]);
  });

  it('given a complete command followed by whitespace, then it stops suggesting while arguments are typed', () => {
    expect(matchCommands('/model openai/gpt-4o')).toEqual([]);
  });
});
