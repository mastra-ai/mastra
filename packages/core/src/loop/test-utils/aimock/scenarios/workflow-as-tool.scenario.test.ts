import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createWorkflow } from '../../../../workflows/create';
import { createStep } from '../../../../workflows/workflow';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: workflows-as-tools integration.
 *
 * When a workflow is registered with an agent, it should appear as a tool
 * named `workflow-<name>` in the model's tool list. When the model calls it,
 * the workflow executes and its result flows back into the next turn's request.
 * A regression in workflow-tool wiring (name, schema, result flow) is caught here.
 */
describe('AIMock loop scenario: workflow as tool', () => {
  const getMock = useLoopScenarioAimock();

  it('exposes workflow as tool with correct name and result flows to next turn', async () => {
    const researchStep = createStep({
      id: 'research-step',
      inputSchema: z.object({ topic: z.string() }),
      outputSchema: z.object({ findings: z.string() }),
      execute: async ({ inputData }) => {
        return { findings: `Research on ${inputData.topic}: detailed findings` };
      },
    });

    const researchWorkflow = createWorkflow({
      id: 'research-workflow',
      description: 'Conducts research on a given topic',
      inputSchema: z.object({ topic: z.string() }),
      outputSchema: z.object({ findings: z.string() }),
    });

    researchWorkflow.then(researchStep).commit();

    const { requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Research quantum computing for me',
      workflows: { researchWorkflow },
      fixtures: llm => {
        // Turn 1: model calls the workflow tool
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              {
                id: 'call_workflow',
                name: 'workflow-researchWorkflow',
                arguments: { inputData: { topic: 'quantum computing' } },
              },
            ],
          },
        );
        // Turn 2: after workflow result, model generates final response
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          {
            content: 'Based on the research, quantum computing shows promise for...',
          },
        );
      },
    });

    expect(requests.length).toBeGreaterThanOrEqual(2);

    // Turn 1 request should contain the workflow tool
    const turn1Request = requests[0];
    const toolNames = turn1Request?.body?.tools?.map((t: any) => t.function?.name) || [];
    expect(toolNames).toContain('workflow-researchWorkflow');

    // Find the workflow tool definition
    const workflowTool = turn1Request?.body?.tools?.find((t: any) => t.function?.name === 'workflow-researchWorkflow');
    expect(workflowTool).toBeDefined();
    expect(workflowTool?.function?.description).toContain('research');

    // Turn 2 request should contain the workflow result
    const turn2Request = requests[1];
    const messages = turn2Request?.body?.messages || [];
    const toolResultMessage = messages.find((m: any) => m.role === 'tool' && m.tool_call_id === 'call_workflow');
    expect(toolResultMessage).toBeDefined();
    expect(toolResultMessage?.content).toContain('quantum computing');
    expect(toolResultMessage?.content).toContain('detailed findings');

    // Output text comes from the second turn
    expect(requests.length).toBe(2);
  });

  it('workflow tool input schema is correctly exposed to model', async () => {
    const analysisStep = createStep({
      id: 'analysis-step',
      inputSchema: z.object({
        data: z.string(),
        depth: z.number().min(1).max(10),
      }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ({ inputData }) => {
        return { result: `Analysis at depth ${inputData.depth}: ${inputData.data}` };
      },
    });

    const analysisWorkflow = createWorkflow({
      id: 'analysis-workflow',
      description: 'Performs deep analysis of data',
      inputSchema: z.object({
        data: z.string().describe('The data to analyze'),
        depth: z.number().describe('Analysis depth from 1-10'),
      }),
      outputSchema: z.object({ result: z.string() }),
    });

    analysisWorkflow.then(analysisStep).commit();

    const { requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Analyze this dataset deeply',
      workflows: { analysisWorkflow },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Analysis complete' });
      },
    });

    // Workflow tool should have correct input schema
    const request = requests[0];
    const workflowTool = request?.body?.tools?.find((t: any) => t.function?.name === 'workflow-analysisWorkflow');
    expect(workflowTool).toBeDefined();

    // Parameters may already be an object
    const inputSchema =
      typeof workflowTool?.function?.parameters === 'string'
        ? JSON.parse(workflowTool.function.parameters)
        : workflowTool?.function?.parameters;

    // Workflow tools wrap the input schema in an inputData property
    expect(inputSchema.properties).toHaveProperty('inputData');
    const inputDataSchema = inputSchema.properties.inputData;
    expect(inputDataSchema.properties).toHaveProperty('data');
    expect(inputDataSchema.properties).toHaveProperty('depth');
    expect(inputDataSchema.properties?.data?.description).toBe('The data to analyze');
    expect(inputDataSchema.properties?.depth?.description).toBe('Analysis depth from 1-10');
  });
});
