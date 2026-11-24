import { describe, expect, it } from 'vitest';

import { parseFrontmatter, stringifyFrontmatter } from './index';

describe('parseFrontmatter', () => {
  it('splits YAML frontmatter from the body', () => {
    const result = parseFrontmatter('---\nname: foo\ndescription: Does foo\n---\n\n# Body\n');
    expect(result.data).toEqual({ name: 'foo', description: 'Does foo' });
    expect(result.content).toBe('\n# Body\n');
  });

  it('returns empty data when the document has no frontmatter', () => {
    expect(parseFrontmatter('# just markdown')).toEqual({ data: {}, content: '# just markdown' });
    expect(parseFrontmatter('')).toEqual({ data: {}, content: '' });
  });

  it('treats a longer dash run as a horizontal rule, not a delimiter', () => {
    expect(parseFrontmatter('----\nname: foo\n---\nbody')).toEqual({ data: {}, content: '----\nname: foo\n---\nbody' });
  });

  it('allows trailing whitespace on the closing delimiter line', () => {
    expect(parseFrontmatter('---\nname: foo\n---  \nbody')).toEqual({ data: { name: 'foo' }, content: 'body' });
    expect(parseFrontmatter('---\nname: foo\n---\t\r\nbody')).toEqual({ data: { name: 'foo' }, content: 'body' });
    expect(parseFrontmatter('---\nname: foo\n--- ')).toEqual({ data: { name: 'foo' }, content: '' });
  });

  it('does not treat ---- or ---foo lines as the closing delimiter', () => {
    // Such lines are never valid YAML inside a mapping, so the parser reports the real
    // problem instead of silently truncating the block there and leaking the rest into the body.
    expect(() => parseFrontmatter('---\nname: foo\n----\n---\nbody')).toThrow();
    expect(() => parseFrontmatter('---\nname: foo\n---foo\n---\nbody')).toThrow();
    expect(() => parseFrontmatter('---\nname: foo\n--- !tag\n---\nbody')).toThrow();
  });

  it('strips a leading byte-order mark', () => {
    expect(parseFrontmatter('﻿---\nname: foo\n---\nbody').data).toEqual({ name: 'foo' });
  });

  it('handles CRLF line endings', () => {
    const result = parseFrontmatter('---\r\nname: foo\r\n---\r\nbody\r\n');
    expect(result.data).toEqual({ name: 'foo' });
    expect(result.content).toBe('body\r\n');
  });

  it('accepts an explicit yaml language tag', () => {
    expect(parseFrontmatter('---yaml\nname: foo\n---\nbody').data).toEqual({ name: 'foo' });
  });

  it('accepts a json language tag', () => {
    expect(parseFrontmatter('---json\n{"name": "foo"}\n---\nbody').data).toEqual({ name: 'foo' });
  });

  it.each(['js', 'javascript'])('rejects ---%s frontmatter without evaluating it', language => {
    const g = globalThis as { __frontmatterEvaluated?: boolean };
    const doc = `---${language}\n{ name: (globalThis.__frontmatterEvaluated = true, "foo") }\n---\nbody`;
    expect(() => parseFrontmatter(doc)).toThrow('JavaScript frontmatter is not supported');
    expect(g.__frontmatterEvaluated).toBeUndefined();
  });

  it('rejects unknown language tags', () => {
    expect(() => parseFrontmatter('---toml\nname = "foo"\n---\nbody')).toThrow(/not supported/);
  });

  it('treats a missing closing delimiter as frontmatter with no body', () => {
    expect(parseFrontmatter('---\nname: foo\n')).toEqual({ data: { name: 'foo' }, content: '' });
  });

  it('returns empty data for a block of only comments or whitespace', () => {
    expect(parseFrontmatter('---\n# nothing here\n\n---\nbody')).toEqual({ data: {}, content: 'body' });
  });

  it('throws on malformed YAML', () => {
    expect(() => parseFrontmatter('---\nname: [unclosed\n---\nbody')).toThrow();
  });

  it('throws when the frontmatter is not a mapping', () => {
    expect(() => parseFrontmatter('---\n- a\n- b\n---\nbody')).toThrow('Frontmatter must be a mapping of fields');
    expect(() => parseFrontmatter('---\njust a string\n---\nbody')).toThrow('Frontmatter must be a mapping of fields');
  });

  it('does not share state between calls', () => {
    const doc = '---\nname: [unclosed\n---\nbody';
    expect(() => parseFrontmatter(doc)).toThrow();
    expect(() => parseFrontmatter(doc)).toThrow();
  });
});

describe('stringifyFrontmatter', () => {
  it('writes a YAML block followed by the body', () => {
    const out = stringifyFrontmatter('# Body', { name: 'foo', description: 'Does foo', metadata: { team: 'ops' } });
    expect(out).toBe('---\nname: foo\ndescription: Does foo\nmetadata:\n  team: ops\n---\n# Body\n');
  });

  it('omits the block when there is no data', () => {
    expect(stringifyFrontmatter('# Body\n', {})).toBe('# Body\n');
  });

  it('round-trips through parseFrontmatter', () => {
    const data = { name: 'foo', description: 'A '.repeat(100).trim(), 'user-invocable': false, compatibility: 'x' };
    const parsed = parseFrontmatter(stringifyFrontmatter('body', data));
    expect(parsed.data).toEqual(data);
    expect(parsed.content).toBe('body\n');
  });
});
