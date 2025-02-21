import { describe, expect, it, vi } from 'vitest';

import { maskStreamTags } from './utils';

describe('maskStreamTags', () => {
  async function* makeStream(chunks: string[]) {
    for (const chunk of chunks) {
      yield chunk;
    }
  }

  async function collectStream(stream: AsyncIterable<string>): Promise<string> {
    let result = '';
    for await (const chunk of stream) {
      result += chunk;
    }
    return result;
  }

  it('should pass through text without tags', async () => {
    const input = ['Hello', ' ', 'world'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Hello world');
  });

  it('should mask content between tags', async () => {
    const input = ['Hello ', '<secret>', 'sensitive', '</secret>', ' world'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Hello  world');
  });

  it('should handle tag split across chunks', async () => {
    const input = ['Hello ', '<sec', 'ret>', 'sensitive', '</sec', 'ret>', ' world'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Hello  world');
  });

  it('should handle tag split across chunks with other data included with the start tag ', async () => {
    const input = ['Hell', 'o <sec', 'ret>', 'sensitive', '</sec', 'ret>', ' world'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Hello  world');
  });

  it('should handle tag split across chunks with other data included with the start and end tag ', async () => {
    const input = ['Hell', 'o <sec', 'ret>', 'sensit', 'ive</sec', 'ret>', ' world'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Hello  world');
  });

  it('should handle tag split across chunks with other data included with the start and end tag where end tag has postfixed text', async () => {
    const input = ['Hell', 'o <sec', 'ret>', 'sensit', 'ive</sec', 'ret> w', 'orld'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Hello  world');
  });

  it('should handle tag split across chunks with other data included with the start and end tag where end tag has postfixed text AND the regular text includes <', async () => {
    const input = ['Hell', 'o <sec', 'ret>', 'sensit', 'ive</sec', 'ret>> 2 w', 'orld', ' 1 <'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Hello > 2 world 1 <');
  });

  it('should handle multiple tag pairs', async () => {
    const input = ['Start ', '<secret>hidden1</secret>', ' middle ', '<secret>hidden2</secret>', ' end'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Start  middle  end');
  });

  it('should not mask content for different tags', async () => {
    const input = ['Hello ', '<other>visible</other>', ' world'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Hello <other>visible</other> world');
  });

  it('should call lifecycle callbacks', async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const onMask = vi.fn();

    const input = ['<secret>', 'hidden', '</secret>'];
    const masked = maskStreamTags(makeStream(input), 'secret', { onStart, onEnd, onMask });
    await collectStream(masked);

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onMask).toHaveBeenCalledWith('hidden');
  });

  it('should handle malformed tags gracefully', async () => {
    const input = ['Start ', '<secret>no closing tag', ' more text', '<secret>another tag</secret>', ' end text'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Start  end text');
  });

  it('should handle empty tag content', async () => {
    const input = ['Before ', '<secret>', '</secret>', ' after', ' and more'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Before  after and more');
  });

  it('should handle whitespace around tags', async () => {
    const input = ['Before ', '  <secret>  ', 'hidden ', ' </secret>  ', ' after'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Before    after');
  });
});
