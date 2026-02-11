import { describe, it, expect } from 'vitest';
import { parseObserverOutput, optimizeObservations } from './observer.js';

describe('parseObserverOutput', () => {
  it('parses well-formed XML output', () => {
    const output = `
<observations>
Date: Jan 15, 2026
* 🔴 (14:30) User building Next.js app
* 🟡 (14:31) Working on auth system
</observations>

<current-task>
Primary: Implementing auth middleware
</current-task>

<suggested-response>
Continue with the middleware implementation
</suggested-response>
`;

    const result = parseObserverOutput(output);

    expect(result.observations).toContain('User building Next.js app');
    expect(result.observations).toContain('Working on auth system');
    expect(result.currentTask).toBe('Primary: Implementing auth middleware');
    expect(result.suggestedResponse).toBe('Continue with the middleware implementation');
  });

  it('handles missing XML tags gracefully', () => {
    const output = `
* 🔴 (14:30) User building Next.js app
* 🟡 (14:31) Working on auth system
`;

    const result = parseObserverOutput(output);

    expect(result.observations).toContain('User building Next.js app');
    expect(result.observations).toContain('Working on auth system');
    expect(result.currentTask).toBeUndefined();
    expect(result.suggestedResponse).toBeUndefined();
  });

  it('extracts date headers', () => {
    const output = `
Date: Jan 15, 2026
* 🔴 (14:30) Key observation
`;

    const result = parseObserverOutput(output);
    expect(result.observations).toContain('Date: Jan 15, 2026');
  });
});

describe('optimizeObservations', () => {
  it('removes medium and low priority emojis', () => {
    const observations = `
* 🔴 (14:30) Critical observation
* 🟡 (14:31) Medium observation
* 🟢 (14:32) Low observation
`;

    const optimized = optimizeObservations(observations);

    expect(optimized).toContain('🔴');
    expect(optimized).not.toContain('🟡');
    expect(optimized).not.toContain('🟢');
    expect(optimized).toContain('Critical observation');
    expect(optimized).toContain('Medium observation');
    expect(optimized).toContain('Low observation');
  });

  it('removes arrow indicators', () => {
    const observations = `* 🟡 (14:33) Agent debugging
  * -> ran git status
  * -> found issue`;

    const optimized = optimizeObservations(observations);
    expect(optimized).not.toContain('->');
    expect(optimized).toContain('ran git status');
  });

  it('cleans up extra whitespace', () => {
    const observations = `* 🔴 (14:30)  Too   many  spaces


Two blank lines above`;

    const optimized = optimizeObservations(observations);
    expect(optimized).not.toContain('  ');
    expect(optimized).not.toMatch(/\n{3,}/);
  });
});
