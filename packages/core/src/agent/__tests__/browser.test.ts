import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { MastraBrowser } from '../../browser';
import { createTool } from '../../tools';
import { Agent } from '../agent';

function createMockModel() {
  return new MockLanguageModelV1({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { promptTokens: 10, completionTokens: 20 },
      text: 'OK',
    }),
    doStream: async () => ({
      stream: new ReadableStream({
        start(c) {
          c.close();
        },
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

function createMockBrowser(toolNames: string[] = ['browser_navigate', 'browser_snapshot']): MastraBrowser {
  const tools: Record<string, any> = {};
  for (const name of toolNames) {
    tools[name] = createTool({
      id: name,
      description: `Mock ${name}`,
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });
  }

  return {
    getTools: () => tools,
    isBrowserRunning: vi.fn().mockReturnValue(false),
    startScreencast: vi.fn().mockResolvedValue({ on: vi.fn(), stop: vi.fn() }),
    startScreencastIfBrowserActive: vi.fn().mockResolvedValue(null),
    injectMouseEvent: vi.fn().mockResolvedValue(undefined),
    injectKeyboardEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as MastraBrowser;
}

describe('Agent browser integration', () => {
  describe('browser getter', () => {
    it('returns undefined when no browser is configured', () => {
      const agent = new Agent({
        id: 'test-agent' as const,
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel(),
      });
      expect(agent.browser).toBeUndefined();
    });

    it('returns the configured browser toolset', () => {
      const browser = createMockBrowser();
      const agent = new Agent({
        id: 'test-agent' as const,
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel(),
        browser,
      });
      expect(agent.browser).toBe(browser);
    });
  });

  describe('listTools', () => {
    it('includes browser tools when browser is configured', () => {
      const browser = createMockBrowser(['browser_navigate', 'browser_snapshot']);
      const agent = new Agent({
        id: 'test-agent' as const,
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel(),
        browser,
      });

      const tools = agent.listTools() as Record<string, any>;
      expect(tools).toHaveProperty('browser_navigate');
      expect(tools).toHaveProperty('browser_snapshot');
    });

    it('does not include browser tools when no browser configured', () => {
      const agent = new Agent({
        id: 'test-agent' as const,
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel(),
      });

      const tools = agent.listTools() as Record<string, any>;
      expect(tools).not.toHaveProperty('browser_navigate');
    });

    it('agent tools take precedence over browser tools', () => {
      const agentTool = createTool({
        id: 'browser_navigate',
        description: 'Agent override of navigate',
        inputSchema: z.object({}),
        outputSchema: z.object({ overridden: z.boolean() }),
        execute: async () => ({ overridden: true }),
      });

      const browser = createMockBrowser(['browser_navigate']);
      const agent = new Agent({
        id: 'test-agent' as const,
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel(),
        tools: { browser_navigate: agentTool },
        browser,
      });

      const tools = agent.listTools() as Record<string, any>;
      // Agent tool should win over browser tool (spread order: { ...browser.tools, ...baseTools })
      expect(tools.browser_navigate.description).toBe('Agent override of navigate');
    });

    it('merges browser tools with agent tools', () => {
      const agentTool = createTool({
        id: 'my_tool',
        description: 'Custom tool',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        execute: async () => ({ ok: true }),
      });

      const browser = createMockBrowser(['browser_navigate', 'browser_click']);
      const agent = new Agent({
        id: 'test-agent' as const,
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel(),
        tools: { my_tool: agentTool },
        browser,
      });

      const tools = agent.listTools() as Record<string, any>;
      expect(Object.keys(tools)).toContain('my_tool');
      expect(Object.keys(tools)).toContain('browser_navigate');
      expect(Object.keys(tools)).toContain('browser_click');
    });
  });
});
