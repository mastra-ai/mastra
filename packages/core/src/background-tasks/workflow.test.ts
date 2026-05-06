import { describe, it, expect, afterEach } from 'vitest';
import { Mastra } from '../mastra';
import { MockStore } from '../storage';
import { BACKGROUND_TASK_WORKFLOW_ID } from './workflow';

describe('background-task workflow registration', () => {
  let mastra: Mastra | undefined;

  afterEach(async () => {
    await mastra?.backgroundTaskManager?.shutdown();
    await mastra?.stopEventEngine();
    mastra = undefined;
  });

  it('registers the workflow when engine is "workflow"', async () => {
    mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: true, engine: 'workflow' },
    });
    // init() is async — wait a tick so the workflow has a chance to register
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mastra.__hasInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID)).toBe(true);
  });

  it('does not register the workflow when engine is "legacy"', async () => {
    mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: true, engine: 'legacy' },
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mastra.__hasInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID)).toBe(false);
  });

  it('registers the workflow when engine is omitted (defaults to "workflow")', async () => {
    mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mastra.__hasInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID)).toBe(true);
  });

  it('does not register the workflow when bg tasks are disabled', async () => {
    mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: false, engine: 'workflow' },
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mastra.__hasInternalWorkflow(BACKGROUND_TASK_WORKFLOW_ID)).toBe(false);
  });
});
