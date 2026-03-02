import { describe, it, expect } from 'vitest';

import { TokenCounter } from '../token-counter';

describe('TokenCounter', () => {
  describe('shared default encoder', () => {
    it('two default TokenCounter instances share the same encoder reference', () => {
      const a = new TokenCounter();
      const b = new TokenCounter();

      // Access private encoder field via cast
      const encoderA = (a as any).encoder;
      const encoderB = (b as any).encoder;

      expect(encoderA).toBe(encoderB);
    });

    it('default encoder produces correct token counts', () => {
      const counter = new TokenCounter();
      const tokens = counter.countString('hello world');
      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    it('two default instances produce identical counts for the same input', () => {
      const a = new TokenCounter();
      const b = new TokenCounter();
      const text = 'The quick brown fox jumps over the lazy dog';

      expect(a.countString(text)).toBe(b.countString(text));
    });
  });

  describe('custom encoding', () => {
    it('constructor with explicit encoding creates a separate encoder instance', () => {
      // When encoding is explicitly passed, a NEW Tiktoken is created — it should NOT be the shared singleton
      const defaultCounter = new TokenCounter();

      // Pass the o200k_base encoding explicitly (CJS require returns the module directly, no .default)
      const o200k_base = require('js-tiktoken/ranks/o200k_base');
      const customCounter = new TokenCounter(o200k_base);

      const encoderDefault = (defaultCounter as any).encoder;
      const encoderCustom = (customCounter as any).encoder;

      // Custom should create a separate instance (not ===)
      expect(encoderCustom).not.toBe(encoderDefault);
    });

    it('custom encoding still produces valid token counts', () => {
      const o200k_base = require('js-tiktoken/ranks/o200k_base');
      const counter = new TokenCounter(o200k_base);

      const tokens = counter.countString('hello world');
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('countString', () => {
    it('returns 0 for empty string', () => {
      const counter = new TokenCounter();
      expect(counter.countString('')).toBe(0);
    });

    it('returns 0 for falsy input', () => {
      const counter = new TokenCounter();
      expect(counter.countString(null as any)).toBe(0);
      expect(counter.countString(undefined as any)).toBe(0);
    });
  });

  describe('countObservations', () => {
    it('delegates to countString', () => {
      const counter = new TokenCounter();
      const text = 'Some observation text';
      expect(counter.countObservations(text)).toBe(counter.countString(text));
    });
  });
});
