import { describe, expect, it } from 'vitest';

import { optimizeObservationsForContext } from './observer-agent';

describe('optimizeObservationsForContext', () => {
  it('should strip yellow and green emojis', async () => {
    const observations = `
- 🔴 Critical info
- 🟡 Medium info
- 🟢 Low info
      `;

    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).toContain('🔴 Critical info');
    expect(optimized).not.toContain('🟡');
    expect(optimized).not.toContain('🟢');
  });

  it('should strip anchor IDs before injecting context', async () => {
    const observations = '[O1] - 🔴 Critical info\n[O2] - 🟡 Medium info';
    const optimized = optimizeObservationsForContext(observations);

    expect(optimized).toContain('🔴 Critical info');
    expect(optimized).toContain('- Medium info');
    expect(optimized).not.toContain('[O1]');
    expect(optimized).not.toContain('[O2]');
  });

  it('should preserve red emojis', async () => {
    const observations = '- 🔴 Critical user preference';
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).toContain('🔴');
  });

  it('should simplify arrows', async () => {
    const observations = '- Task -> completed successfully';
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).not.toContain('->');
  });

  it('should collapse multiple newlines', async () => {
    const observations = `Line 1



Line 2`;
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).not.toContain('\n\n\n');
  });

  it('should preserve markdown link text', async () => {
    const observations = '- 🔴 Agent shared [the setup guide](https://example.com/setup)';
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).toContain('[the setup guide](https://example.com/setup)');
  });

  it('should preserve multiple markdown links on one line', async () => {
    const observations = '- 🔴 Compared [option A](https://example.com/a) and [option B](https://example.com/b)';
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).toContain('[option A](https://example.com/a)');
    expect(optimized).toContain('[option B](https://example.com/b)');
  });

  it('should preserve markdown links using fragment targets', async () => {
    const observations = '- 🔴 Rendered [Item name](#preview=item&id=abc123)';
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).toContain('[Item name](#preview=item&id=abc123)');
  });

  it('should still strip semantic tags that are not markdown links', async () => {
    const observations = '- 🔴 [tag one, tag two] User prefers direct answers';
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).not.toContain('[tag one, tag two]');
    expect(optimized).toContain('User prefers direct answers');
  });

  it('should strip semantic tags while preserving an adjacent markdown link', async () => {
    const observations = '- 🔴 [internal] Agent shared [the guide](https://example.com/guide)';
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).not.toContain('[internal]');
    expect(optimized).toContain('[the guide](https://example.com/guide)');
  });

  it('should preserve collapsed item markers', async () => {
    const observations = '- 🔴 History trimmed [72 items collapsed - ID: b1fa]';
    const optimized = optimizeObservationsForContext(observations);
    expect(optimized).toContain('[72 items collapsed - ID: b1fa]');
  });
});
