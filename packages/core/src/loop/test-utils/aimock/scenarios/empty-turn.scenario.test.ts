import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: empty/no-tool turn (model returns text immediately).
 *
 * Tests that when the model returns plain text without calling any tools,
 * the loop completes successfully with a single request. This is the simplest
 * possible loop behavior and should never break.
 */
describe('AIMock loop scenario: empty/no-tool turn', () => {
  const getMock = useLoopScenarioAimock();

  it('completes immediately when model returns text without tool calls', async () => {
    const unusedTool = createTool({
      id: 'unused_tool',
      description: 'A tool that should not be called',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => ({}),
    });

    const { requests, output, chunks } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Say hello',
      tools: { unused_tool: unusedTool },
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Hello! How can I help you?' });
      },
    });

    // Should have exactly 1 request (the initial prompt)
    expect(requests).toHaveLength(1);

    // The request should include the user prompt
    const serialized = JSON.stringify(requests[0]?.body?.messages ?? []);
    expect(serialized).toContain('Say hello');

    // The output should contain the model's response
    const text = await output.text;
    expect(text).toContain('Hello');
    expect(text).toContain('How can I help you');

    // Should not have any tool-call chunks
    const toolCallChunks = chunks?.filter((c: any) => c.type === 'tool-call') ?? [];
    expect(toolCallChunks).toHaveLength(0);
  });

  it('completes immediately even when tools are available but not called', async () => {
    const tool1 = createTool({
      id: 'tool_one',
      description: 'First tool',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ output: z.string() }),
      execute: async ({ input }) => ({ output: `processed: ${input}` }),
    });

    const tool2 = createTool({
      id: 'tool_two',
      description: 'Second tool',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ output: z.string() }),
      execute: async ({ input }) => ({ output: `processed: ${input}` }),
    });

    const { requests, output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'What is the weather?',
      tools: { tool_one: tool1, tool_two: tool2 },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: "I don't have access to weather data." });
      },
    });

    // Should have exactly 1 request
    expect(requests).toHaveLength(1);

    // The request should include both tools in the tools array
    const tools = requests[0]?.body?.tools ?? [];
    expect(tools).toHaveLength(2);
    expect(tools.some((t: any) => t.function?.name === 'tool_one')).toBe(true);
    expect(tools.some((t: any) => t.function?.name === 'tool_two')).toBe(true);

    // The output should be the model's text response
    const text = await output.text;
    expect(text).toContain("don't have access");
  });

  it('handles empty string response gracefully', async () => {
    const { requests, output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Return empty',
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: '' });
      },
    });

    // Should have exactly 1 request
    expect(requests).toHaveLength(1);

    // The output should be an empty string
    const text = await output.text;
    expect(text).toBe('');
  });
});
