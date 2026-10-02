import { describe, it, expect } from 'vitest';
import { SandboxError, SandboxUnsupportedFeatureError } from './errors';
import {
  assertModesUnsupported,
  validateSandboxFileMode,
  MAX_SANDBOX_FILE_MODE,
  type SandboxFileInput,
} from './sandbox';

describe('validateSandboxFileMode', () => {
  it('accepts valid permission modes', () => {
    expect(() => validateSandboxFileMode(0o001)).not.toThrow();
    expect(() => validateSandboxFileMode(0o644)).not.toThrow();
    expect(() => validateSandboxFileMode(0o600)).not.toThrow();
    expect(() => validateSandboxFileMode(MAX_SANDBOX_FILE_MODE)).not.toThrow();
  });

  it('rejects zero, negative, out-of-range, and non-integer modes', () => {
    for (const bad of [0, -1, 0o1000, 1.5, NaN]) {
      expect(() => validateSandboxFileMode(bad)).toThrowError(SandboxError);
    }
  });

  it('sets code INVALID_ARGUMENT on rejection', () => {
    try {
      validateSandboxFileMode(-1);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SandboxError);
      expect((err as SandboxError).code).toBe('INVALID_ARGUMENT');
    }
  });
});

describe('assertModesUnsupported', () => {
  const files = (mode?: number): SandboxFileInput[] => [{ path: 'a.txt', content: 'x', mode }];

  it('passes when no file specifies a mode', () => {
    expect(() => assertModesUnsupported(files(undefined), 'Test')).not.toThrow();
    expect(() => assertModesUnsupported([], 'Test')).not.toThrow();
  });

  it('throws SandboxUnsupportedFeatureError when any file specifies a mode', () => {
    try {
      assertModesUnsupported(files(0o600), 'Test');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SandboxUnsupportedFeatureError);
      expect((err as SandboxError).code).toBe('UNSUPPORTED_FEATURE');
    }
  });

  it('throws even when mode is 0', () => {
    expect(() => assertModesUnsupported(files(0), 'Test')).toThrowError(SandboxUnsupportedFeatureError);
  });
});
