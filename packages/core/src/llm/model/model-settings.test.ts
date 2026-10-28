import { describe, expect, it } from 'vitest';
import { validateModelTimeoutSettings } from './model-settings';

describe('validateModelTimeoutSettings', () => {
  it('accepts omitted, empty, and positive finite timeout settings', () => {
    expect(validateModelTimeoutSettings(undefined)).toBeUndefined();
    expect(validateModelTimeoutSettings({})).toEqual({});
    expect(validateModelTimeoutSettings({ totalMs: 1, stepMs: 2, firstChunkMs: 3 })).toEqual({
      totalMs: 1,
      stepMs: 2,
      firstChunkMs: 3,
    });
  });

  it.each([50, null, [], '50', true])('rejects non-object timeout settings: %j', timeout => {
    expect(() => validateModelTimeoutSettings(timeout)).toThrowError(
      '`modelSettings.timeout` must be an object with optional `totalMs`, `stepMs`, and `firstChunkMs` properties.',
    );
  });

  it.each([
    ['totalMs', 0],
    ['stepMs', -1],
    ['firstChunkMs', Number.NaN],
    ['stepMs', Number.POSITIVE_INFINITY],
    ['totalMs', '50'],
  ])('rejects an invalid %s value: %j', (name, value) => {
    expect(() => validateModelTimeoutSettings({ [name]: value })).toThrowError(
      `\`modelSettings.timeout.${name}\` must be a positive, finite number of milliseconds.`,
    );
  });
});
