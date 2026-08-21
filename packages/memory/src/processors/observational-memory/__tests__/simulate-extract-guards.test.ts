import { describe, expect, it } from 'vitest';

import {
  assertLocalTarget,
  buildThreadSelection,
  isLocalPostgresUrl,
  parseArgs,
} from '../../../../scripts/simulate/extract';

describe('simulate extract — local target guard', () => {
  it.each([
    'postgres://127.0.0.1/simulate_input',
    'postgres://127.0.0.1:55432/simulate_input',
    'postgres://user:pw@localhost:55432/simulate_input',
    'postgres://localhost/simulate_input',
    'postgres://user@[::1]:55432/simulate_input',
  ])('accepts %s', url => {
    expect(isLocalPostgresUrl(url)).toBe(true);
    expect(() => assertLocalTarget(url)).not.toThrow();
  });

  it.each([
    'postgres://user:pw@ep-something.us-west-2.aws.neon.tech/neondb',
    'postgres://notlocalhost/db',
    'postgres://localhost.evil.com:55432/db',
    'postgres://my-localhost/db',
    'postgres://10.0.0.5:5432/db',
    'not a url',
  ])('rejects %s', url => {
    expect(isLocalPostgresUrl(url)).toBe(false);
    expect(() => assertLocalTarget(url)).toThrow(/non-local target/);
  });
});

describe('simulate extract — thread selection', () => {
  it('selects explicit ids', () => {
    const selection = buildThreadSelection({ threadIds: ['a', 'b'] });
    expect(selection.sql).toContain('ANY($1::text[])');
    expect(selection.params).toEqual([['a', 'b']]);
  });

  it('selects the most recent N threads carrying an OM record', () => {
    const selection = buildThreadSelection({ threads: 5 });
    expect(selection.sql).toContain('mastra_observational_memory');
    expect(selection.sql).toContain('LIMIT $1');
    expect(selection.params).toEqual([5]);
  });

  it('refuses both modes at once, and neither', () => {
    expect(() => buildThreadSelection({ threads: 5, threadIds: ['a'] })).toThrow(/exactly one/);
    expect(() => buildThreadSelection({})).toThrow(/exactly one/);
  });

  it('refuses a non-positive thread count', () => {
    expect(() => buildThreadSelection({ threads: 0 })).toThrow(/positive integer/);
    expect(() => buildThreadSelection({ threads: 1.5 })).toThrow(/positive integer/);
  });
});

describe('simulate extract — arg parsing', () => {
  it('collects repeated --thread-id', () => {
    const args = parseArgs(['--source', 's', '--target', 't', '--thread-id', 'a', '--thread-id', 'b']);
    expect(args).toEqual({ source: 's', target: 't', threadIds: ['a', 'b'] });
  });

  it('requires source and target', () => {
    expect(() => parseArgs(['--target', 't'])).toThrow(/--source/);
    expect(() => parseArgs(['--source', 's'])).toThrow(/--target/);
  });

  it('rejects unknown flags', () => {
    expect(() => parseArgs(['--nope'])).toThrow(/unknown flag/);
  });
});
