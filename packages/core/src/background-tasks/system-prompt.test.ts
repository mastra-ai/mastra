import { describe, expect, it } from 'vitest';
import { generateBackgroundTaskSystemPrompt } from './system-prompt';

describe('generateBackgroundTaskSystemPrompt', () => {
  it('describes eligible tools as foreground by default and background as per-call opt-in', () => {
    const prompt = generateBackgroundTaskSystemPrompt({
      research: { background: { enabled: true } },
      calculator: {},
    });

    expect(prompt).toContain('- research (default: foreground)');
    expect(prompt).not.toContain('- calculator');
    expect(prompt).toContain('Background execution is always per-call opt-in');
    expect(prompt).toContain('omitting the field never starts background work');
  });

  it('uses agent eligibility overrides without making calls default to background', () => {
    const prompt = generateBackgroundTaskSystemPrompt(
      {
        research: { background: { enabled: true } },
        lookup: {},
      },
      { tools: { research: false, lookup: true } },
    );

    expect(prompt).not.toContain('- research');
    expect(prompt).toContain('- lookup (default: foreground)');
  });

  it('returns undefined when no tools are eligible', () => {
    expect(generateBackgroundTaskSystemPrompt({ calculator: {} })).toBeUndefined();
  });
});
