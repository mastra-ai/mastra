import { describe, expect, it } from 'vitest';
import { applyOpencodeSessionHeader } from './opencode-session-header.js';

describe('applyOpencodeSessionHeader', () => {
  it('does not add a session header for non-opencode providers', () => {
    const headers = { 'User-Agent': 'mastra/1.0.0', 'x-thread-id': 'thread-1' };

    expect(applyOpencodeSessionHeader('openai', headers)).toEqual(headers);
  });

  it('leaves missing headers undefined for non-opencode providers', () => {
    expect(applyOpencodeSessionHeader('openai')).toBeUndefined();
  });

  it('preserves an explicit x-opencode-session header', () => {
    const result = applyOpencodeSessionHeader('opencode-go', {
      'x-opencode-session': 'sess-explicit',
      'x-thread-id': 'thread-1',
    });

    expect(result?.['x-opencode-session']).toBe('sess-explicit');
  });

  it('treats an existing session header as case-insensitive', () => {
    const result = applyOpencodeSessionHeader('opencode-go', {
      'X-OpenCode-Session': 'sess-explicit',
    });

    expect(result?.['X-OpenCode-Session']).toBe('sess-explicit');
    expect(result?.['x-opencode-session']).toBeUndefined();
  });

  it('reuses x-thread-id as the OpenCode session id', () => {
    const result = applyOpencodeSessionHeader('opencode-go', {
      'x-thread-id': 'thread-123',
    });

    expect(result?.['x-opencode-session']).toBe('thread-123');
  });

  it('reuses x-thread-id when the thread header uses a different case', () => {
    const result = applyOpencodeSessionHeader('opencode-go', {
      'X-Thread-Id': 'thread-123',
    });

    expect(result?.['x-opencode-session']).toBe('thread-123');
  });

  it('generates a session id for OpenCode Go when none is available', () => {
    const result = applyOpencodeSessionHeader('opencode-go', { 'User-Agent': 'mastra/1.0.0' });

    expect(result?.['x-opencode-session']).toEqual(expect.any(String));
    expect(result?.['x-opencode-session']?.length).toBeGreaterThan(0);
    expect(result?.['User-Agent']).toBe('mastra/1.0.0');
  });

  it('generates a session id for OpenCode Zen when none is available', () => {
    const result = applyOpencodeSessionHeader('opencode', {});

    expect(result?.['x-opencode-session']).toEqual(expect.any(String));
    expect(result?.['x-opencode-session']?.length).toBeGreaterThan(0);
  });
});
