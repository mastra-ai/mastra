import { describe, expect, it } from 'vitest';
import { getCurrentPlanRelativePath } from '../../utils/plans.js';
import { planModePrompt } from './plan.js';

describe('planModePrompt', () => {
  it('renders the real thread-scoped plan path when threadId is present', () => {
    const threadId = 'e50ca4c1-99b8-4eb1-a3cc-f61e12d93792';
    const prompt = planModePrompt({ state: { threadId } });
    const expectedPath = getCurrentPlanRelativePath(threadId);

    expect(prompt).toContain(expectedPath);
    expect(prompt).not.toContain('<current-thread>');
  });

  it('falls back to currentThreadId when threadId is absent', () => {
    const threadId = 'thread-from-current';
    const prompt = planModePrompt({ state: { currentThreadId: threadId } });

    expect(prompt).toContain(getCurrentPlanRelativePath(threadId));
    expect(prompt).not.toContain('<current-thread>');
  });

  it('renders a placeholder path when no threadId is available', () => {
    const prompt = planModePrompt({ state: {} });

    expect(prompt).toContain('.mastracode/plans/threads/<current-thread>/current-plan.md');
  });
});
