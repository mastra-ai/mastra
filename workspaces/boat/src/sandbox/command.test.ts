import { describe, expect, it } from 'vitest';

import { newOutputSince, withEnv } from './command';

describe('withEnv', () => {
  it('leaves a command untouched when there is nothing to inject', () => {
    expect(withEnv('ls -la')).toBe('ls -la');
    expect(withEnv('ls -la', {})).toBe('ls -la');
  });

  it('drops undefined values rather than exporting an empty variable', () => {
    expect(withEnv('ls', { NOT_SET: undefined })).toBe('ls');
  });

  it('wraps the command with the variables it needs', () => {
    expect(withEnv('echo $FOO', { FOO: 'bar' })).toBe("env FOO=bar sh -c 'echo $FOO'");
  });

  it('quotes values so they cannot be read as shell syntax', () => {
    const wrapped = withEnv('printenv EVIL', { EVIL: '"; rm -rf /; echo "' });

    expect(wrapped).toContain(`EVIL='"; rm -rf /; echo "'`);
    // The injection attempt survives as a single quoted argument rather than
    // becoming a second command.
    expect(wrapped.match(/rm -rf/g)).toHaveLength(1);
  });

  it('quotes values containing single quotes', () => {
    expect(withEnv('printenv Q', { Q: "it's" })).toBe(`env Q='it'\\''s' sh -c 'printenv Q'`);
  });

  it('carries multiple variables in a single wrapper', () => {
    expect(withEnv('echo hi', { A: '1', B: '2' })).toBe("env A=1 B=2 sh -c 'echo hi'");
  });
});

describe('newOutputSince', () => {
  it('returns only what has been appended', () => {
    expect(newOutputSince('hello', 'hello world')).toBe(' world');
  });

  it('returns nothing when the stream has not grown', () => {
    expect(newOutputSince('hello', 'hello')).toBe('');
  });

  it('returns nothing when the stream came back shorter than what was emitted', () => {
    // A rotated log or a short read must not replay output from the start.
    expect(newOutputSince('hello world', 'hello')).toBe('');
  });

  it('returns the whole stream when nothing has been emitted yet', () => {
    expect(newOutputSince('', 'first output')).toBe('first output');
  });
});
