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

function createMockBrowser(
  toolNames: string[] = ['browser_navigate', 'browser_snapshot'],
  options: { headless?: boolean; provider?: string; id?: string } = {},
): MastraBrowser {
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
    id: options.id ?? 'mock-browser-id',
    provider: options.provider ?? 'mock',
    headless: options.headless ?? true,
    getTools: () => tools,
    isBrowserRunning: vi.fn().mockReturnValue(true),
    getCurrentUrl: vi.fn().mockResolvedValue('https://example.com'),
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
    it('does not include browser tools (they are added at execution time)', () => {
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
      // listTools only returns agent-configured tools
      expect(Object.keys(tools)).toContain('my_tool');
      // Browser tools are NOT included in listTools - they're added at execution time
      expect(Object.keys(tools)).not.toContain('browser_navigate');
      expect(Object.keys(tools)).not.toContain('browser_click');
    });
  });

  describe('headless getter', () => {
    it('exposes headless as a typed property', () => {
      const browser = createMockBrowser([], { headless: false });
      expect(browser.headless).toBe(false);

      const headlessBrowser = createMockBrowser([], { headless: true });
      expect(headlessBrowser.headless).toBe(true);
    });
  });

  describe('browser context population', () => {
    it('populates browser context with provider info', () => {
      const browser = createMockBrowser(['browser_navigate'], {
        headless: true,
        provider: 'playwright',
        id: 'test-session-123',
      });

      // Verify the mock browser has the expected properties
      expect(browser.provider).toBe('playwright');
      expect(browser.id).toBe('test-session-123');
      expect(browser.headless).toBe(true);
      expect(browser.isBrowserRunning()).toBe(true);
    });
  });
});
