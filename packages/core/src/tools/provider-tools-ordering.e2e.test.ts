import { anthropic } from '@ai-sdk/anthropic-v5';
import { createGatewayMock } from '@internal/test-utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
import { createTool } from '../tools';

const mock = createGatewayMock({ mode: 'replay' });
beforeAll(() => mock.start());
afterAll(() => mock.saveAndStop());

describe('provider-executed tool ordering (Anthropic compatibility)', () => {
  it(
    'second turn should not 400 when first turn has client tool_use before server_tool_use',
    { timeout: 120_000 },
    async () => {
      const mockMemory = new MockMemory();
      const webSearch = anthropic.tools.webSearch_20250305({});

      const clientTool = createTool({
        id: 'find_files',
        description: 'Find files in the workspace matching a pattern.',
        inputSchema: z.object({
          path: z.string().describe('Directory to search'),
          pattern: z.string().optional().describe('Glob pattern to filter'),
        }),
        outputSchema: z.object({
          files: z.array(z.string()),
        }),
        execute: async input => {
          return { files: [`${input.path}/index.ts`, `${input.path}/utils.ts`] };
        },
      });

      const agent = new Agent({
        id: 'test-ordering-agent',
        name: 'test-ordering-agent',
        instructions:
          'You are a coding assistant. When asked, use both find_files and web_search in parallel. Always call find_files FIRST, then web_search.',
        model: 'anthropic/claude-sonnet-4-20250514',
        memory: mockMemory,
        tools: { web_search: webSearch, find_files: clientTool },
      });

      const threadId = 'thread-ordering-test';
      const resourceId = 'resource-ordering-test';

      // ── Turn 1: trigger both tools ──
      const turn1 = await agent.stream(
        'Find TypeScript files in src/ AND search the web for "TypeScript 5.8 release". Use both tools at the same time.',
        { memory: { thread: threadId, resource: resourceId } },
      );
      await turn1.consumeStream();
      const turn1Text = await turn1.text;
      expect(turn1Text.length).toBeGreaterThan(0);

      // ── Turn 2: follow-up that loads persisted history ──
      // If the history has broken tool ordering, Anthropic will reject with 400:
      // "tool_use ids were found without tool_result blocks immediately after"
      const turn2 = await agent.stream('Thanks! Can you summarize what you found?', {
        memory: { thread: threadId, resource: resourceId },
      });
      await turn2.consumeStream();
      const turn2Text = await turn2.text;
      expect(turn2Text.length).toBeGreaterThan(0);
    },
  );
});
