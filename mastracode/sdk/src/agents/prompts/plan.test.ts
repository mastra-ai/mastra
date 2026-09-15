import { describe, expect, it } from 'vitest';
import { planModePrompt } from './plan.js';

describe('planModePrompt', () => {
  it('instructs ordinary sessions to write named plan files into .mastracode/plans/', () => {
    const prompt = planModePrompt({ state: {} });

    expect(prompt).toContain('.mastracode/plans/');
    expect(prompt).toContain('.mastracode/plans/add-dark-mode.md');
    expect(prompt).not.toContain('.artifacts/plans/');
  });

  it('instructs Factory sessions to write named plan files into .artifacts/plans/', () => {
    const prompt = planModePrompt({ state: { factoryProjectId: 'factory-123' } });

    expect(prompt).toContain('.artifacts/plans/');
    expect(prompt).toContain('.artifacts/plans/add-dark-mode.md');
    expect(prompt).not.toContain('.mastracode/plans/');
  });

  it('tells the agent to submit_plan with a path, not the plan body', () => {
    const prompt = planModePrompt({ state: {} });

    expect(prompt).toContain('submit_plan');
    expect(prompt).toMatch(/submit_plan\(\{\s*\n?\s*path:/);
    expect(prompt).toContain('Reuse the same file');
  });
});
