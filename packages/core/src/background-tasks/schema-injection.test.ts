import { describe, it, expect } from 'vitest';
import { injectBackgroundSchema, isBackgroundEligible, backgroundOverrideJsonSchema } from './schema-injection';

describe('isBackgroundEligible', () => {
  it('returns false when no config', () => {
    expect(isBackgroundEligible('tool')).toBe(false);
  });

  it('returns true when tool config enables it', () => {
    expect(isBackgroundEligible('tool', { enabled: true })).toBe(true);
  });

  it('returns false when tool config disables it', () => {
    expect(isBackgroundEligible('tool', { enabled: false })).toBe(false);
  });

  it('agent "all" overrides tool config', () => {
    expect(isBackgroundEligible('tool', { enabled: false }, { tools: 'all' })).toBe(true);
  });

  it('agent per-tool false overrides tool config true', () => {
    expect(isBackgroundEligible('tool', { enabled: true }, { tools: { tool: false } })).toBe(false);
  });

  it('agent per-tool object', () => {
    expect(isBackgroundEligible('tool', undefined, { tools: { tool: { enabled: true } } })).toBe(true);
  });

  it('falls through to tool config when agent has no entry for this tool', () => {
    expect(isBackgroundEligible('tool', { enabled: true }, { tools: { 'other-tool': true } })).toBe(true);
  });
});

describe('injectBackgroundSchema', () => {
  const baseSchema = {
    type: 'object',
    properties: {
      query: { type: 'string' },
    },
    required: ['query'],
  };

  it('does not inject when tool is not background-eligible', () => {
    const result = injectBackgroundSchema('tool', baseSchema);
    expect(result).toBe(baseSchema); // Same reference — not modified
    expect((result as any).properties._background).toBeUndefined();
  });

  it('injects _background property when tool is eligible', () => {
    const result = injectBackgroundSchema('tool', baseSchema, { enabled: true });

    expect(result).not.toBe(baseSchema); // New object
    expect((result as any).properties.query).toEqual({ type: 'string' });
    expect((result as any).properties._background).toEqual(backgroundOverrideJsonSchema);
  });

  it('preserves all original properties', () => {
    const result = injectBackgroundSchema('tool', baseSchema, { enabled: true });
    expect((result as any).required).toEqual(['query']);
    expect((result as any).type).toBe('object');
  });

  it('does not inject into non-object schemas', () => {
    const stringSchema = { type: 'string' };
    const result = injectBackgroundSchema('tool', stringSchema, { enabled: true });
    expect(result).toBe(stringSchema);
  });

  it('does not mutate the original schema', () => {
    const original = { ...baseSchema, properties: { ...baseSchema.properties } };
    injectBackgroundSchema('tool', original, { enabled: true });
    expect(original.properties._background).toBeUndefined();
  });

  it('works with agent config "all"', () => {
    const result = injectBackgroundSchema('tool', baseSchema, undefined, { tools: 'all' });
    expect((result as any).properties._background).toEqual(backgroundOverrideJsonSchema);
  });
});
