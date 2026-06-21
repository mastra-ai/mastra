import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: structured output with tool calls in the same turn.
 *
 * Extends the basic structured-output scenario to test edge cases where
 * tool calls and structured output interact:
 * 1. Multiple tool calls whose results are aggregated into a single structured object.
 * 2. Nested schema fields populated by different tool results.
 * 3. Tool results feeding into structured output validation.
 */
describe('AIMock loop scenario: structured output with tool calls', () => {
  const getMock = useLoopScenarioAimock();

  it('aggregates multiple tool results into a single structured object', async () => {
    const getUserTool = createTool({
      id: 'get_user',
      description: 'Get user profile data.',
      inputSchema: z.object({ userId: z.string() }),
      outputSchema: z.object({ name: z.string(), email: z.string() }),
      execute: async ({ userId }) => ({ name: `User_${userId}`, email: `${userId}@test.com` }),
    });

    const getOrderTool = createTool({
      id: 'get_order',
      description: 'Get order data.',
      inputSchema: z.object({ orderId: z.string() }),
      outputSchema: z.object({ total: z.number(), items: z.array(z.string()) }),
      execute: async ({ orderId }) => ({ total: 99.99, items: [`item_${orderId}_1`, `item_${orderId}_2`] }),
    });

    const schema = z.object({
      user: z.object({ name: z.string(), email: z.string() }),
      order: z.object({ total: z.number(), items: z.array(z.string()) }),
      summary: z.string(),
    });

    const { output, requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Get user u123 profile and order o456, then produce a structured report.',
      tools: { get_user: getUserTool, get_order: getOrderTool },
      stopWhen: stepCountIs(6),
      structuredOutput: { schema },
      fixtures: llm => {
        // Turn 1: call both tools in parallel.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_user', name: 'get_user', arguments: { userId: 'u123' } },
              { id: 'call_order', name: 'get_order', arguments: { orderId: 'o456' } },
            ],
          },
        );
        // Turn 2: produce structured output combining both results.
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          {
            content: JSON.stringify({
              user: { name: 'User_u123', email: 'u123@test.com' },
              order: { total: 99.99, items: ['item_o456_1', 'item_o456_2'] },
              summary: 'User u123 has order o456 totaling 99.99 with 2 items.',
            }),
          },
        );
      },
    });

    // Both tool calls were made.
    expect(requests.length).toBeGreaterThanOrEqual(2);

    // Turn 2 request should contain both tool results.
    const turn2Messages = (requests[1]?.body as any)?.messages ?? [];
    const toolMessages = turn2Messages.filter((m: any) => m.role === 'tool');
    expect(toolMessages.length).toBe(2);

    // Verify both tool results are present.
    const toolContents = toolMessages.map((m: any) => JSON.stringify(m.content));
    expect(toolContents.some((c: string) => c.includes('User_u123'))).toBe(true);
    expect(toolContents.some((c: string) => c.includes('99.99'))).toBe(true);

    // Structured output is valid and combines both tool results.
    const object = await (output as unknown as { object: Promise<unknown> }).object;
    const parsed = schema.parse(object);
    expect(parsed.user.name).toBe('User_u123');
    expect(parsed.order.total).toBe(99.99);
    expect(parsed.order.items).toHaveLength(2);
    expect(parsed.summary).toContain('99.99');
  });

  it('produces structured output with nested arrays from sequential tool calls', async () => {
    let callCount = 0;

    const searchTool = createTool({
      id: 'search',
      description: 'Search for items.',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ results: z.array(z.string()) }),
      execute: async ({ query }) => {
        callCount++;
        return { results: [`result_${query}_${callCount}`] };
      },
    });

    const schema = z.object({
      allResults: z.array(z.string()),
      queryCount: z.number(),
    });

    const { output, requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Search for cats, then dogs, then combine results.',
      tools: { search: searchTool },
      stopWhen: stepCountIs(6),
      structuredOutput: { schema },
      fixtures: llm => {
        // Turn 1: search for cats.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_cats', name: 'search', arguments: { query: 'cats' } },
            ],
          },
        );
        // Turn 2: search for dogs.
        llm.on(
          { endpoint: 'chat', hasToolResult: true, toolCallId: 'call_cats' },
          {
            toolCalls: [
              { id: 'call_dogs', name: 'search', arguments: { query: 'dogs' } },
            ],
          },
        );
        // Turn 3: produce structured output combining both.
        llm.on(
          { endpoint: 'chat', hasToolResult: true, toolCallId: 'call_dogs' },
          {
            content: JSON.stringify({
              allResults: ['result_cats_1', 'result_dogs_2'],
              queryCount: 2,
            }),
          },
        );
      },
    });

    // 3 tool turns + 1 structured output turn = 4 requests minimum.
    expect(requests.length).toBeGreaterThanOrEqual(3);

    // Both searches were executed.
    expect(callCount).toBe(2);

    // Turn 3 request should contain both tool results in message history.
    const turn3Messages = (requests[2]?.body as any)?.messages ?? [];
    const serialized3 = JSON.stringify(turn3Messages);
    expect(serialized3).toContain('result_cats_1');
    expect(serialized3).toContain('result_dogs_2');

    // Structured output aggregates both search results.
    const object = await (output as unknown as { object: Promise<unknown> }).object;
    const parsed = schema.parse(object);
    expect(parsed.allResults).toHaveLength(2);
    expect(parsed.allResults).toContain('result_cats_1');
    expect(parsed.allResults).toContain('result_dogs_2');
    expect(parsed.queryCount).toBe(2);
  });

  it('validates tool results feed into structured output schema correctly', async () => {
    const getMetricsTool = createTool({
      id: 'get_metrics',
      description: 'Get system metrics.',
      inputSchema: z.object({}),
      outputSchema: z.object({
        cpu: z.number(),
        memory: z.number(),
        status: z.string(),
      }),
      execute: async () => ({ cpu: 45.2, memory: 78.5, status: 'healthy' }),
    });

    // Schema requires numeric fields that must come from the tool.
    const schema = z.object({
      systemStatus: z.string(),
      cpuUsage: z.number().min(0).max(100),
      memoryUsage: z.number().min(0).max(100),
      overallHealth: z.enum(['healthy', 'degraded', 'critical']),
    });

    const { output, requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Get system metrics and produce a health report.',
      tools: { get_metrics: getMetricsTool },
      stopWhen: stepCountIs(5),
      structuredOutput: { schema },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_metrics', name: 'get_metrics', arguments: {} },
            ],
          },
        );
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          {
            content: JSON.stringify({
              systemStatus: 'healthy',
              cpuUsage: 45.2,
              memoryUsage: 78.5,
              overallHealth: 'healthy',
            }),
          },
        );
      },
    });

    expect(requests.length).toBeGreaterThanOrEqual(2);

    // Turn 2 request should contain the metrics tool result.
    const turn2Messages = (requests[1]?.body as any)?.messages ?? [];
    const serialized2 = JSON.stringify(turn2Messages);
    expect(serialized2).toContain('45.2');
    expect(serialized2).toContain('78.5');
    expect(serialized2).toContain('healthy');

    // Structured output validates numeric constraints from schema.
    const object = await (output as unknown as { object: Promise<unknown> }).object;
    const parsed = schema.parse(object);
    expect(parsed.cpuUsage).toBe(45.2);
    expect(parsed.memoryUsage).toBe(78.5);
    expect(parsed.overallHealth).toBe('healthy');
    // CPU and memory must be within the schema's min/max bounds.
    expect(parsed.cpuUsage).toBeGreaterThanOrEqual(0);
    expect(parsed.cpuUsage).toBeLessThanOrEqual(100);
  });
});
