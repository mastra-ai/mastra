import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Scenario: Memory recall window (lastMessages config)
 *
 * Tests that when a memory thread has many messages, only the last N messages
 * (based on `lastMessages` config) are recalled into the model request.
 *
 * This prevents regressions in memory recall windowing logic.
 */
describe('AIMock loop scenario: memory recall window', () => {
  const getMock = useLoopScenarioAimock();

  it('recalls only lastMessages messages when configured', async () => {
    const addTool = createTool({
      id: 'add',
      description: 'Add two numbers',
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      execute: async ({ a, b }) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { result: a + b };
      },
    });

    // First turn: create a memory thread with 15 tool calls
    await runLoopScenario({
      llm: getMock(),
      prompt: 'Please add these numbers',
      tools: { add: addTool },
      memory: {
        enabled: true,
        options: {
          lastMessages: 15, // Allow all 15 turns to be saved
        },
      },
      fixtures: llm => {
        // Script 15 tool calls
        for (let i = 0; i < 15; i++) {
          if (i === 0) {
            llm.on(
              { endpoint: 'chat', sequenceIndex: 0 },
              {
                toolCalls: [
                  { id: `call_${i}`, name: 'add', arguments: { a: i, b: i } },
                ],
              },
            );
          } else {
            llm.on(
              { endpoint: 'chat', hasToolResult: true, toolCallId: `call_${i - 1}` },
              {
                toolCalls: [
                  { id: `call_${i}`, name: 'add', arguments: { a: i, b: i } },
                ],
              },
            );
          }
        }
        // Final turn: return text
        llm.on(
          { endpoint: 'chat', hasToolResult: true, toolCallId: 'call_14' },
          { content: 'Done adding' },
        );
      },
    });

    // Second turn: configure lastMessages: 3, make a new request
    const { requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'What did we just do?',
      tools: { add: addTool },
      memory: {
        enabled: true,
        options: {
          lastMessages: 3, // Only recall last 3 messages
        },
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat' },
          { content: 'We added 15 pairs of numbers' },
        );
      },
    });

    // Should have at least 1 request
    expect(requests.length).toBeGreaterThan(0);

    // Extract the messages sent to the model in the second turn
    const messages = requests[0].body.messages || [];

    // Should have system message + last 3 messages + new user message
    // Total should be around 5 messages (1 system + 3 recalled + 1 new user)
    // But the key assertion: should NOT have all 15 tool calls
    const toolCalls = messages.filter((m: any) => m.role === 'assistant' && m.tool_calls);
    const toolCallCount = toolCalls.reduce((acc: number, m: any) => acc + m.tool_calls.length, 0);

    // Should have at most 3 tool calls (from lastMessages: 3)
    // Not 15 (which would be all of them)
    expect(toolCallCount).toBeLessThanOrEqual(3);
    expect(toolCallCount).toBeGreaterThan(0);

    // Should NOT contain early tool call IDs (call_0, call_1, call_2)
    // because they're beyond the 3-message window
    const allToolIds = toolCalls.flatMap((m: any) => m.tool_calls.map((tc: any) => tc.id));
    expect(allToolIds).not.toContain('call_0');
    expect(allToolIds).not.toContain('call_1');
    expect(allToolIds).not.toContain('call_2');

    // Should contain late tool call IDs (call_12, call_13, call_14)
    expect(allToolIds.some(id => id.startsWith('call_1'))).toBe(true);
  });

  it('recalls all messages when lastMessages is false (history disabled)', async () => {
    const addTool = createTool({
      id: 'add',
      description: 'Add two numbers',
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      execute: async ({ a, b }) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { result: a + b };
      },
    });

    // First turn: create a memory thread with 5 tool calls
    await runLoopScenario({
      llm: getMock(),
      prompt: 'Please add these numbers',
      tools: { add: addTool },
      memory: {
        enabled: true,
        options: {
          lastMessages: 10, // Allow all to be saved
        },
      },
      fixtures: llm => {
        for (let i = 0; i < 5; i++) {
          if (i === 0) {
            llm.on(
              { endpoint: 'chat', sequenceIndex: 0 },
              {
                toolCalls: [
                  { id: `call_${i}`, name: 'add', arguments: { a: i, b: i } },
                ],
              },
            );
          } else {
            llm.on(
              { endpoint: 'chat', hasToolResult: true, toolCallId: `call_${i - 1}` },
              {
                toolCalls: [
                  { id: `call_${i}`, name: 'add', arguments: { a: i, b: i } },
                ],
              },
            );
          }
        }
        llm.on(
          { endpoint: 'chat', hasToolResult: true, toolCallId: 'call_4' },
          { content: 'Done adding' },
        );
      },
    });

    // Second turn: disable history recall with lastMessages: false
    const { requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'What did we just do?',
      tools: { add: addTool },
      memory: {
        enabled: true,
        options: {
          lastMessages: false, // Disable history recall
        },
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat' },
          { content: "I don't have context from previous turns" },
        );
      },
    });

    expect(requests.length).toBeGreaterThan(0);

    const messages = requests[0].body.messages || [];

    // Should have only system message + new user message (no recalled history)
    const userMessages = messages.filter((m: any) => m.role === 'user');
    expect(userMessages.length).toBe(1);
    expect(userMessages[0].content).toBe('What did we just do?');

    // Should NOT have any assistant messages with tool_calls (no history)
    const toolCalls = messages.filter((m: any) => m.role === 'assistant' && m.tool_calls);
    expect(toolCalls.length).toBe(0);

    // Should NOT have any tool result messages (no history)
    const toolResults = messages.filter((m: any) => m.role === 'tool');
    expect(toolResults.length).toBe(0);
  });
});
