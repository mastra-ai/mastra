import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { Mastra } from '@mastra/core/mastra';
import { createStep } from '@mastra/core/workflows';
import { MockStore } from '@mastra/core/storage';
import { VercelWorkflow, registerMastra, clearMastra } from './index';

describe('VercelWorkflow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearMastra();
  });

  it('should execute sequential steps', async () => {
    const step1Execute = vi.fn().mockResolvedValue({ value: 'step1-output' });
    const step2Execute = vi.fn().mockResolvedValue({ value: 'step2-output' });

    const step1 = createStep({
      id: 'step1',
      execute: step1Execute,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: step2Execute,
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    const workflow = new VercelWorkflow({
      id: 'test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    const mastra = new Mastra({
      storage: new MockStore(),
      workflows: { 'test-workflow': workflow },
    });

    registerMastra(mastra);

    const run = await workflow.createRun();
    const result = await run.start({ inputData: {} });

    expect(step1Execute).toHaveBeenCalled();
    expect(step2Execute).toHaveBeenCalled();
    expect(result.steps.step1.status).toBe('success');
    expect(result.steps.step2.status).toBe('success');
  });
});
