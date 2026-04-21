import { describe, it, expect } from 'vitest';
import { stripThreadTags } from '../message-utils';

describe('stripThreadTags', () => {
  it('removes <thread> open tags with attributes', () => {
    expect(stripThreadTags('<thread id="abc">hello')).toBe('hello');
    expect(stripThreadTags('<thread>hello')).toBe('hello');
  });

  it('removes </thread> close tags', () => {
    expect(stripThreadTags('hello</thread>')).toBe('hello');
  });

  it('removes both open and close tags, trimming whitespace', () => {
    expect(stripThreadTags('  <thread id="1">hello world</thread>  ')).toBe('hello world');
  });

  it('is case-insensitive', () => {
    expect(stripThreadTags('<THREAD>hello</Thread>')).toBe('hello');
  });

  it('leaves unrelated angle-bracket text alone', () => {
    expect(stripThreadTags('<threading> kept')).toBe('<threading> kept');
    expect(stripThreadTags('a < b && c > d')).toBe('a < b && c > d');
  });

  it('runs in linear time on pathological input (no ReDoS)', () => {
    const input = '<thread'.repeat(5_000);
    const start = Date.now();
    stripThreadTags(input);
    // A quadratic implementation would take multiple seconds here.
    expect(Date.now() - start).toBeLessThan(500);
  });
});
