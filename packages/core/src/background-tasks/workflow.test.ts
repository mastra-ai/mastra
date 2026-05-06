import { describe, it, expect, afterEach } from 'vitest';
import { Mastra } from '../mastra';
import { MockStore } from '../storage';
import { BACKGROUND_TASK_WORKFLOW_ID } from './workflow';

/**
 * Wait for the bg-task workflow registration to land on Mastra. The
 * `BackgroundTaskManager` runs `init()` asynchronously from the Mastra
 * constructor, so we poll instead of using a fixed sleep — fixed sleeps
 * race on slow CI.
 */
async function waitForWorkflowRegistration(mastra: Mastra, expected: boolean, timeoutMs = 1000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (mastra.__hasInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID) === expected) return expected;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  return mastra.__hasInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID);
}

describe('background-task workflow registration', () => {
  let mastra: Mastra | undefined;

  afterEach(async () => {
    await mastra?.backgroundTaskManager?.shutdown();
    await mastra?.stopEventEngine();
    mastra = undefined;
  });

  it('registers the workflow when bg tasks are enabled', async () => {
    mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
    });

    expect(await waitForWorkflowRegistration(mastra, true)).toBe(true);
  });

  it('does not register the workflow when bg tasks are disabled', async () => {
    mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: false },
    });

    // Brief delay so any (incorrect) registration would have a chance to land.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mastra.__hasInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID)).toBe(false);
  });
});
