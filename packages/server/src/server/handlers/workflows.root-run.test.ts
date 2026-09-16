import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EXECUTE_WORKFLOW_STEP_ROUTE } from './workflows';

describe('remote workflow step root identity', () => {
  it.each([true, false])('preserves the public tool contract when root identity is present: %s', async present => {
    const rootRun = { workflowId: 'outer', runId: 'outer-run' };
    const seen: unknown[] = [];
    const schema = z.object({ item: z.string() });
    const tool = createTool({
      id: 'remote-tool',
      inputSchema: schema,
      outputSchema: schema,
      execute: async (input, context) => {
        seen.push(context.workflow);
        return input;
      },
    });
    const helper = createWorkflow({ id: 'helper', inputSchema: schema, outputSchema: schema })
      .then(createStep(tool))
      .commit();
    const mastra = new Mastra({ workflows: { helper }, logger: false });
    const body = EXECUTE_WORKFLOW_STEP_ROUTE.bodySchema!.parse(
      JSON.parse(
        JSON.stringify({
          ...(present ? { rootRun } : {}),
          stepId: 'remote-tool',
          executionPath: [0],
          stepResults: {},
          state: {},
          requestContext: { rootRun: { workflowId: 'forged', runId: 'forged' } },
          input: { item: 'document' },
        }),
      ),
    );
    const result = await EXECUTE_WORKFLOW_STEP_ROUTE.handler({
      mastra,
      workflowId: 'helper',
      runId: 'child-run',
      ...body,
    });
    expect(result).toMatchObject({ status: 'success', output: { item: 'document' } });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ workflowId: 'helper', runId: 'child-run', rootRun: present ? rootRun : undefined });
  });
});
