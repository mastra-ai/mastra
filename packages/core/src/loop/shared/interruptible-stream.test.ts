import { describe, expect, it } from 'vitest';
import { startsResponseContent } from './interruptible-stream';

describe('startsResponseContent', () => {
  it.each(['reasoning-start', 'reasoning-delta', 'reasoning-end', 'response-metadata', 'raw', 'step-start', 'finish'])(
    'leaves a request interruptible after %s',
    type => {
      expect(startsResponseContent({ type })).toBe(false);
    },
  );

  it.each([
    'text-start',
    'text-delta',
    'text-end',
    'tool-call-input-streaming-start',
    'tool-call-input-streaming-end',
    'tool-call-delta',
    'tool-call',
    'tool-result',
    'tool-error',
    'object',
    'object-result',
    'file',
    'source',
  ])('protects a request once %s arrives', type => {
    expect(startsResponseContent({ type })).toBe(true);
  });
});
