import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../agent';

function createTestWorkflow() {
  const schema = z.object({ value: z.string() });
  const step = createStep({
    id: 'echo-step',
    inputSchema: schema,
    outputSchema: schema,
    execute: async ({ inputData }) => inputData,
  });

  return createWorkflow({
    id: 'echo',
    inputSchema: schema,
    outputSchema: schema,
  })
    .then(step)
    .commit();
}

describe('workflow background config', () => {
  it('injects _background into workflow tool schemas when background task dispatch is enabled', async () => {
    const agent = new Agent({
      id: 'workflow-agent',
      name: 'Workflow Agent',
      instructions: 'Run the workflow.',
      model: new MockLanguageModelV2(),
      workflows: { echo: createTestWorkflow() },
      backgroundTasks: { tools: { echo: true } },
    });

    const tools = await agent.getToolsForExecution({ backgroundTaskEnabled: true });
    const workflowTool = tools['workflow-echo'];
    const schema = (workflowTool.parameters as { jsonSchema?: { properties?: Record<string, unknown> } }).jsonSchema;

    expect(schema?.properties).toHaveProperty('_background');
  });
});
