import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Client tools scenario.
 *
 * Tests that client-side tools (defined via clientTools parameter) are properly
 * merged with agent-level tools and can be called by the model during execution.
 */
describeForAllEngines('AIMock scenario: client tools', engine => {
  const getMock = useLoopScenarioAimock();

  it('should merge client tools with agent tools in request', async () => {
    // Create an agent-level tool
    const agentTool = createTool({
      id: 'agent-tool',
      description: 'A tool defined at agent level',
      inputSchema: z.object({ input: z.string() }),
      execute: async ({ input }) => ({ result: `agent: ${input}` }),
    });

    // Create a client-level tool
    const clientTool = createTool({
      id: 'client-tool',
      description: 'A tool defined at client level',
      inputSchema: z.object({ input: z.string() }),
      execute: async ({ input }) => ({ result: `client: ${input}` }),
    });

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      tools: { 'agent-tool': agentTool },
      clientTools: { 'client-tool': clientTool },
      stopWhen: stepCountIs(1),
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, { content: 'Hello!' });
      },
    });

    // Verify both tools were included in the request
    const firstRequest = requests[0];
    expect(firstRequest?.body).toBeDefined();

    const toolDefinitions = firstRequest?.body?.tools || [];
    const agentToolDef = toolDefinitions.find((t: any) => t.function.name === 'agent-tool');
    const clientToolDef = toolDefinitions.find((t: any) => t.function.name === 'client-tool');

    expect(agentToolDef).toBeDefined();
    expect(agentToolDef?.function.description).toBe('A tool defined at agent level');

    expect(clientToolDef).toBeDefined();
    expect(clientToolDef?.function.description).toBe('A tool defined at client level');
  });

  it('should pass client tools to model in request', async () => {
    const clientTool = createTool({
      id: 'client-tool',
      description: 'A client-side tool',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => ({ answer: `Answer for: ${query}` }),
    });

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Use the client tool',
      clientTools: { 'client-tool': clientTool },
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              {
                id: 'call-client',
                name: 'client-tool',
                arguments: { query: 'test' },
              },
            ],
          },
        );

        llm.on({ endpoint: 'chat', toolCallId: 'call-client', hasToolResult: true }, { content: 'Done' });
      },
    });

    // Verify the client tool was included in the model request
    const firstRequest = requests[0];
    expect(firstRequest?.body).toBeDefined();

    const toolDefinitions = firstRequest?.body?.tools || [];
    const clientToolDef = toolDefinitions.find((t: any) => t.function.name === 'client-tool');
    expect(clientToolDef).toBeDefined();
    expect(clientToolDef?.function.description).toBe('A client-side tool');
  });
});
