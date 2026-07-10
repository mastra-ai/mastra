import { describe, expect, it } from 'vitest';
import { planModePrompt } from './plan.js';

describe('planModePrompt', () => {
  it('instructs writing named plan files into .mastracode/plans/', () => {
    const prompt = planModePrompt({ state: {} });

    expect(prompt).toContain('.mastracode/plans/');
    expect(prompt).toContain('.mastracode/plans/add-dark-mode.md');
  });

  it('tells the agent to submit_plan with a path, not the plan body', () => {
    const prompt = planModePrompt({ state: {} });

    expect(prompt).toContain('submit_plan');
    expect(prompt).toMatch(/submit_plan\(\{\s*\n?\s*path:/);
    expect(prompt).toContain('Reuse the same file');
  });

  it('tells the agent to resolve open questions with ask_user before submitting', () => {
    const prompt = planModePrompt({ state: {} });

    expect(prompt).toContain('Resolve Open Questions BEFORE Submitting');
    expect(prompt).toContain('ask_user');
    expect(prompt).toMatch(/before .*submit_plan/i);
  });
});
