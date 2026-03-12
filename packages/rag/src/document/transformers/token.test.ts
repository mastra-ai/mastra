import { getEncoding, encodingForModel } from 'js-tiktoken';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { TokenTransformer } from './token';

vi.mock('js-tiktoken', () => {
  const createMockTokenizer = () => ({
    encode: (text: string) => Array.from({ length: Math.ceil(text.length / 4) }, (_, i) => i),
    decode: (tokens: number[]) => 'x'.repeat(tokens.length * 4),
  });

  return {
    getEncoding: vi.fn(() => createMockTokenizer()),
    encodingForModel: vi.fn(() => createMockTokenizer()),
  };
});

describe('TokenTransformer', () => {
  beforeEach(() => {
    vi.mocked(getEncoding).mockClear();
    vi.mocked(encodingForModel).mockClear();
  });

  describe('fromTikToken', () => {
    it('should create only one encoder when using encodingName', () => {
      TokenTransformer.fromTikToken({
        encodingName: 'cl100k_base',
        options: { maxSize: 500, overlap: 0 },
      });

      expect(getEncoding).toHaveBeenCalledTimes(1);
      expect(encodingForModel).not.toHaveBeenCalled();
    });

    it('should create only one encoder when using modelName', () => {
      TokenTransformer.fromTikToken({
        modelName: 'gpt-4',
        options: { maxSize: 500, overlap: 0 },
      });

      expect(encodingForModel).toHaveBeenCalledTimes(1);
      expect(getEncoding).not.toHaveBeenCalled();
    });
  });
});
