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

  it('should stream a completed server tool result when a client tool stays pending in the same step (#21637)', async () => {
    // A server-side tool (has execute) and a client-side tool (no execute, resolved by the
    // browser) are called in the same step. The turn ends so the client can resolve its own
    // tool, but the server tool already finished — its result must still be streamed, or the
    // client sits on an unresolved tool call forever and never sends the follow-up request.
    const serverTool = createTool({
      id: 'server-tool',
      description: 'Runs on the server',
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => ({ record: `record-${id}` }),
    });

    const browserTool = createTool({
      id: 'browser-tool',
      description: 'Runs in the browser',
      inputSchema: z.object({ id: z.string() }),
      // No execute: the client executes this one and sends the result back.
    });

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Use both tools',
      tools: { 'server-tool': serverTool },
      clientTools: { 'browser-tool': browserTool },
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call-server', name: 'server-tool', arguments: { id: '42' } },
              { id: 'call-browser', name: 'browser-tool', arguments: { id: '42' } },
            ],
          },
        );
      },
    });

    const toolResults = (chunks ?? []).filter((c: any) => c.type === 'tool-result');

    // The completed server-side tool is streamed as a terminal result...
    const serverResult = toolResults.find((c: any) => c.payload?.toolCallId === 'call-server');
    expect(serverResult).toBeDefined();
    expect((serverResult as any)?.payload?.result).toEqual({ record: 'record-42' });

    // ...while the client-side tool stays unresolved for the client to complete.
    expect(toolResults.some((c: any) => c.payload?.toolCallId === 'call-browser')).toBe(false);
  });
});
