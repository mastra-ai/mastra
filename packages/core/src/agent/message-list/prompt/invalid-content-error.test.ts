/**
 * Tests for packages/core/src/agent/message-list/prompt/invalid-content-error.ts
 *
 * `InvalidDataContentError` is a small error subclass with no I/O. Coverage
 * focuses on its documented contract: the default message format, the
 * marker-based `isInstance` type guard (as opposed to `instanceof`), and
 * that constructor overrides (message/cause) are respected.
 */
import { describe, expect, it } from 'vitest';

import { InvalidDataContentError } from './invalid-content-error';

describe('InvalidDataContentError', () => {
  it('is an instance of Error', () => {
    const error = new InvalidDataContentError({ content: 123 });

    expect(error).toBeInstanceOf(Error);
  });

  it('stores the provided content', () => {
    const content = new Uint8Array([1, 2, 3]);
    const error = new InvalidDataContentError({ content });

    expect(error.content).toBe(content);
  });

  it('builds a default message that includes the typeof the invalid content', () => {
    const error = new InvalidDataContentError({ content: 42 });

    expect(error.message).toBe(
      'Invalid data content. Expected a base64 string, Uint8Array, ArrayBuffer, or Buffer, but got number.',
    );
  });

  it('reflects the actual typeof for different invalid content types in the default message', () => {
    expect(new InvalidDataContentError({ content: {} }).message).toContain('got object');
    expect(new InvalidDataContentError({ content: true }).message).toContain('got boolean');
    expect(new InvalidDataContentError({ content: undefined }).message).toContain('got undefined');
  });

  it('uses a custom message when one is provided instead of the default', () => {
    const error = new InvalidDataContentError({ content: 'x', message: 'totally custom message' });

    expect(error.message).toBe('totally custom message');
  });

  it('carries the provided cause', () => {
    const cause = new Error('root cause');
    const error = new InvalidDataContentError({ content: 'x', cause });

    expect(error.cause).toBe(cause);
  });

  it('recognizes an error constructed by this class via isInstance', () => {
    const error = new InvalidDataContentError({ content: 'x' });

    expect(InvalidDataContentError.isInstance(error)).toBe(true);
  });

  it('does not recognize a plain Error via isInstance', () => {
    expect(InvalidDataContentError.isInstance(new Error('nope'))).toBe(false);
  });

  it('does not recognize non-error values via isInstance', () => {
    expect(InvalidDataContentError.isInstance('a string')).toBe(false);
    expect(InvalidDataContentError.isInstance(null)).toBe(false);
    expect(InvalidDataContentError.isInstance(undefined)).toBe(false);
    expect(InvalidDataContentError.isInstance({})).toBe(false);
  });

  it('survives a JSON-like round trip check via its own marker rather than instanceof across realms', () => {
    // isInstance is marker-based specifically so it still works for errors
    // that fail a plain `instanceof` check (e.g. crossing a bundler/realm
    // boundary). We can't easily simulate a second realm here, but we can
    // assert the marker property itself is present and truthy.
    const error = new InvalidDataContentError({ content: 'x' });
    const marker = Symbol.for('vercel.ai.error.AI_InvalidDataContentError');

    expect((error as unknown as Record<symbol, unknown>)[marker]).toBe(true);
  });
});
