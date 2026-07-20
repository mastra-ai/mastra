import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: request-level toolsets.
 *
 * `agent.stream({ toolsets })` merges additional tool sets into the available
 * tools for that specific request, allowing dynamic tool availability without
 * reconstructing the agent. These scenarios pin that merge contract so refactors
 * to tool resolution don't accidentally drop request-level tools or break the
 * override semantics when a toolset tool has the same name as an agent tool.
 */
describeForAllEngines('AIMock loop scenario: toolsets override', engine => {
  const getMock = useLoopScenarioAimock();

  it('makes toolset tools available to the model alongside agent-level tools', async () => {
    const defaultTool = createTool({
      id: 'default_tool',
      description: 'An agent-level tool.',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      execute: async () => ({ result: 'from agent' }),
    });

    const toolsetTool = createTool({
      id: 'toolset_tool',
      description: 'A request-level toolset tool.',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      execute: async () => ({ result: 'from toolset' }),
    });

    const { requests, output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Call the toolset tool.',
      tools: { default_tool: defaultTool },
      toolsets: { dynamic: { toolset_tool: toolsetTool } },
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        // Turn 1: call the toolset tool (should be available).
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_ts', name: 'toolset_tool', arguments: {} }] },
        );
        // Turn 2: after tool result, wrap up.
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_ts', hasToolResult: true },
          { content: 'I called the toolset tool and got: from toolset' },
        );
      },
    });

    // Both tools were available in the turn-1 request.
    const turn1Tools = requests[0]?.body?.tools ?? [];
    const toolNames = turn1Tools.map((t: any) => t.function.name);
    expect(toolNames).toContain('default_tool');
    expect(toolNames).toContain('toolset_tool');

    // The toolset tool was called and its result flowed back.
    expect(requests).toHaveLength(2);
    const turn2Messages = requests[1]?.body?.messages ?? [];
    const toolMessage = turn2Messages.find(message => (message as { role?: string }).role === 'tool') as
      | { tool_call_id?: string; content?: unknown }
      | undefined;
    expect(toolMessage?.tool_call_id).toBe('call_ts');
    expect(JSON.stringify(toolMessage?.content)).toMatch(/toolset/i);

    const text = await output.text;
    expect(text).toContain('from toolset');
  });

  it('toolset tool with same name as agent tool takes precedence', async () => {
    const agentVersion = createTool({
      id: 'shared_tool',
      description: 'Agent-level version.',
      inputSchema: z.object({}),
      outputSchema: z.object({ source: z.string() }),
      execute: async () => ({ source: 'agent' }),
    });

    const toolsetVersion = createTool({
      id: 'shared_tool',
      description: 'Toolset-level version (overrides).',
      inputSchema: z.object({}),
      outputSchema: z.object({ source: z.string() }),
      execute: async () => ({ source: 'toolset' }),
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Call the shared tool.',
      tools: { shared_tool: agentVersion },
      toolsets: { override: { shared_tool: toolsetVersion } },
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_shared', name: 'shared_tool', arguments: {} }] },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_shared', hasToolResult: true },
          { content: 'The tool ran successfully.' },
        );
      },
    });

    // The toolset version should take precedence — its description or execution
    // result should reflect the toolset source, not the agent source.
    expect(requests).toHaveLength(2);

    const turn2Messages = requests[1]?.body?.messages ?? [];
    const toolMessage = turn2Messages.find(message => (message as { role?: string }).role === 'tool') as
      | { content?: unknown }
      | undefined;
    // The tool result should come from the toolset version.
    expect(JSON.stringify(toolMessage?.content)).toMatch(/toolset/i);
  });
});
