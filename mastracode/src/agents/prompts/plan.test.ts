import { describe, expect, it } from 'vitest';
import { planModePrompt } from './plan.js';

describe('planModePrompt', () => {
  it('instructs writing named plan files into .mastracode/plans/', () => {
    const prompt = planModePrompt({ state: {} });

    expect(prompt).toContain('.mastracode/plans/');
    expect(prompt).toContain('.mastracode/plans/add-dark-mode.md');
  });

  it('tells the agent to submit_plan with a title, not a path or body', () => {
    const prompt = planModePrompt({ state: {} });

    expect(prompt).toContain('submit_plan');
    expect(prompt).toMatch(/submit_plan\(\{\s*\n?\s*title:/);
    expect(prompt).toContain('Reuse the same title and file');
  });
});
