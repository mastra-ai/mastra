import { describe, expect, it } from 'vitest';
import { generateBackgroundTaskSystemPrompt } from './system-prompt';

describe('generateBackgroundTaskSystemPrompt', () => {
  it('describes eligible tools as background by default', () => {
    const prompt = generateBackgroundTaskSystemPrompt({
      research: { background: { enabled: true } },
      calculator: {},
    });

    expect(prompt).toContain('- research (default: background)');
    expect(prompt).not.toContain('- calculator');
  });

  it('describes foreground-default tools as per-call opt-in', () => {
    const prompt = generateBackgroundTaskSystemPrompt({
      research: { background: { enabled: true, defaultDisposition: 'foreground' } },
      scan: { background: { enabled: true } },
    });

    expect(prompt).toContain('- research (default: foreground — opt in with "_background")');
    expect(prompt).toContain('- scan (default: background)');
    expect(prompt).toContain('omitting "_background" never starts background work');
  });

  it('uses agent eligibility overrides, including agent-level defaultDisposition', () => {
    const prompt = generateBackgroundTaskSystemPrompt(
      {
        research: { background: { enabled: true } },
        lookup: {},
      },
      { tools: { research: false, lookup: { enabled: true, defaultDisposition: 'foreground' } } },
    );

    expect(prompt).not.toContain('- research');
    expect(prompt).toContain('- lookup (default: foreground — opt in with "_background")');
  });

  it('returns undefined when no tools are eligible', () => {
    expect(generateBackgroundTaskSystemPrompt({ calculator: {} })).toBeUndefined();
  });
});
