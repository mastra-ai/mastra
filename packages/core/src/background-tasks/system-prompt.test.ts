import { describe, it, expect } from 'vitest';
import { generateBackgroundTaskSystemPrompt } from './system-prompt';

describe('generateBackgroundTaskSystemPrompt', () => {
  it('returns undefined when no tools are background-eligible', () => {
    const result = generateBackgroundTaskSystemPrompt({
      'tool-a': { description: 'A tool' },
      'tool-b': { description: 'Another tool' },
    });

    expect(result).toBeUndefined();
  });

  it('lists eligible tools with their defaults', () => {
    const result = generateBackgroundTaskSystemPrompt({
      'slow-research': { background: { enabled: true }, description: 'Research tool' },
      'quick-lookup': { description: 'Fast lookup' },
      'deep-analysis': { background: { enabled: true }, description: 'Analysis tool' },
    });

    expect(result).toBeDefined();
    expect(result).toContain('slow-research (default: background)');
    expect(result).toContain('deep-analysis (default: background)');
    expect(result).not.toContain('quick-lookup');
  });

  it('respects agent config "all"', () => {
    const result = generateBackgroundTaskSystemPrompt(
      {
        'tool-a': { description: 'A' },
        'tool-b': { description: 'B' },
      },
      { tools: 'all' },
    );

    expect(result).toBeDefined();
    expect(result).toContain('tool-a');
    expect(result).toContain('tool-b');
  });

  it('shows foreground default when agent enables but tool has no config', () => {
    const result = generateBackgroundTaskSystemPrompt(
      {
        'my-tool': { description: 'A tool' },
      },
      { tools: { 'my-tool': true } },
    );

    expect(result).toBeDefined();
    expect(result).toContain('my-tool (default: foreground)');
  });

  it('includes the _background override syntax', () => {
    const result = generateBackgroundTaskSystemPrompt({
      tool: { background: { enabled: true } },
    });

    expect(result).toContain('"_background"');
    expect(result).toContain('"enabled"');
    expect(result).toContain('"timeoutMs"');
  });

  it('includes guidelines', () => {
    const result = generateBackgroundTaskSystemPrompt({
      tool: { background: { enabled: true } },
    });

    expect(result).toContain('Guidelines');
    expect(result).toContain('background execution');
    expect(result).toContain('foreground execution');
  });
});
