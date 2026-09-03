import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { isStandardSchemaWithJSON, standardSchemaToJSONSchema } from '../../schema';
import { createTool } from '../../tools';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../agent';

// Regression coverage for the bug where `getToolsForExecution` did not
// forward `backgroundTaskEnabled` to `listWorkflowTools`, so a workflow tool
// whitelisted in the agent's `backgroundTasks.tools` was advertised as
// background-eligible in the system prompt but never received the
// `_background` field in its input schema.

function extractJsonProperties(tool: Record<string, any>) {
  const schema = tool.parameters ?? tool.inputSchema;
  expect(schema).toBeDefined();
  const json = isStandardSchemaWithJSON(schema)
    ? standardSchemaToJSONSchema(schema, { io: 'input' })
    : (schema.jsonSchema ?? schema);
  return ((json as any).properties ?? {}) as Record<string, any>;
}

function buildWorkflow() {
  const step = createStep({
    id: 'echo-step',
    inputSchema: z.object({ prompt: z.string() }),
    outputSchema: z.object({ text: z.string() }),
    execute: async ({ inputData }) => ({ text: inputData.prompt }),
  });
  return createWorkflow({
    id: 'my-workflow',
    description: 'Echo workflow',
    inputSchema: z.object({ prompt: z.string() }),
    outputSchema: z.object({ text: z.string() }),
  })
    .then(step)
    .commit();
}

describe('workflow tool _background schema injection', () => {
  it('injects _background into a whitelisted workflow tool schema', async () => {
    const agent = new Agent({
      id: 'wf-agent',
      name: 'wf-agent',
      instructions: 'Run workflows.',
      model: new MockLanguageModelV2(),
      workflows: { myWorkflow: buildWorkflow() },
      // Note: `resolveAgentToolConfig` strips the `workflow-` prefix, so the
      // whitelist key is the bare workflow name.
      backgroundTasks: { tools: { myWorkflow: true } },
    });

    const tools = await agent.getToolsForExecution({ backgroundTaskEnabled: true });

    const workflowTool = tools['workflow-myWorkflow'];
    expect(workflowTool).toBeDefined();
    expect(extractJsonProperties(workflowTool!)).toHaveProperty('_background');
  });

  it('does not inject _background into ineligible tools', async () => {
    const agent = new Agent({
      id: 'wf-agent-2',
      name: 'wf-agent-2',
      instructions: 'Run workflows.',
      model: new MockLanguageModelV2(),
      workflows: { myWorkflow: buildWorkflow() },
      tools: {
        greet: createTool({
          id: 'greet',
          description: 'Greet someone.',
          inputSchema: z.object({ name: z.string() }),
          outputSchema: z.object({ greeting: z.string() }),
          execute: async ({ name }) => ({ greeting: `Hello, ${name}` }),
        }),
      },
      backgroundTasks: { tools: { greet: true } },
    });

    const tools = await agent.getToolsForExecution({ backgroundTaskEnabled: true });

    expect(extractJsonProperties(tools['greet']!)).toHaveProperty('_background');
    expect(extractJsonProperties(tools['workflow-myWorkflow']!)).not.toHaveProperty('_background');
  });
});
