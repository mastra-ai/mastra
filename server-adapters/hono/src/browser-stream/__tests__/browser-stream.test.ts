import type { MastraBrowser } from '@mastra/core/browser';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupBrowserStream } from '../index.js';

interface MockMastraBrowser {
  hasThreadSession: ReturnType<typeof vi.fn>;
  getScope: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  closeThreadSession: ReturnType<typeof vi.fn>;
}

function createMockToolset(overrides: Partial<MockMastraBrowser> = {}): MockMastraBrowser {
  return {
    hasThreadSession: vi.fn().mockReturnValue(false),
    getScope: vi.fn().mockReturnValue('shared'),
    close: vi.fn().mockResolvedValue(undefined),
    closeThreadSession: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('hono browser-stream routes', () => {
  let app: Hono;
  let toolsets: Map<string, MockMastraBrowser>;
  let getToolset: (agentId: string) => MastraBrowser | undefined;

  beforeEach(async () => {
    app = new Hono();
    toolsets = new Map();
    getToolset = ((agentId: string) => toolsets.get(agentId)) as (agentId: string) => MastraBrowser | undefined;
    await setupBrowserStream(app, { getToolset });
  });

  describe('GET /api/agents/:agentId/browser/session (probe)', () => {
    it('returns hasSession: false and screencastAvailable: true when no toolset is configured', async () => {
      const response = await app.request('http://localhost/api/agents/agent-without-browser/browser/session');

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ hasSession: false, screencastAvailable: true });
    });

    it('returns hasSession: false when toolset exists but no threadId is provided', async () => {
      const toolset = createMockToolset();
      toolsets.set('agent-1', toolset);

      const response = await app.request('http://localhost/api/agents/agent-1/browser/session');

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ hasSession: false, screencastAvailable: true });
      expect(toolset.hasThreadSession).not.toHaveBeenCalled();
    });

    it('returns hasSession: true when toolset reports an active session for the thread', async () => {
      const toolset = createMockToolset({ hasThreadSession: vi.fn().mockReturnValue(true) });
      toolsets.set('agent-1', toolset);

      const response = await app.request('http://localhost/api/agents/agent-1/browser/session?threadId=thread-1');

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ hasSession: true, screencastAvailable: true });
      expect(toolset.hasThreadSession).toHaveBeenCalledWith('thread-1');
    });

    it('returns hasSession: false when toolset reports no session for the thread', async () => {
      const toolset = createMockToolset({ hasThreadSession: vi.fn().mockReturnValue(false) });
      toolsets.set('agent-1', toolset);

      const response = await app.request('http://localhost/api/agents/agent-1/browser/session?threadId=thread-1');

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ hasSession: false, screencastAvailable: true });
      expect(toolset.hasThreadSession).toHaveBeenCalledWith('thread-1');
    });

    it('returns screencastAvailable: true regardless of session state when the route is registered', async () => {
      // The probe route is only registered when setupBrowserStream succeeds, so the
      // screencastAvailable: false path is exercised in the deployer fallback, not here.
      const toolset = createMockToolset();
      toolsets.set('agent-1', toolset);

      const response = await app.request('http://localhost/api/agents/agent-1/browser/session?threadId=thread-1');
      const body = (await response.json()) as { screencastAvailable: boolean };

      expect(body.screencastAvailable).toBe(true);
    });
  });

  describe('POST /api/agents/:agentId/browser/close', () => {
    it('returns 404 when no toolset is configured for the agent', async () => {
      const response = await app.request('http://localhost/api/agents/agent-without-browser/browser/close', {
        method: 'POST',
      });

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'No browser session for this agent' });
    });

    it('closes the entire toolset for shared scope', async () => {
      const toolset = createMockToolset({ getScope: vi.fn().mockReturnValue('shared') });
      toolsets.set('agent-1', toolset);

      const response = await app.request('http://localhost/api/agents/agent-1/browser/close', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ threadId: 'thread-1' }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ success: true });
      expect(toolset.close).toHaveBeenCalledTimes(1);
      expect(toolset.closeThreadSession).not.toHaveBeenCalled();
    });

    it('closes only the thread session for thread scope when threadId is provided', async () => {
      const toolset = createMockToolset({ getScope: vi.fn().mockReturnValue('thread') });
      toolsets.set('agent-1', toolset);

      const response = await app.request('http://localhost/api/agents/agent-1/browser/close', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ threadId: 'thread-1' }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ success: true });
      expect(toolset.closeThreadSession).toHaveBeenCalledWith('thread-1');
      expect(toolset.close).not.toHaveBeenCalled();
    });

    it('closes the entire toolset for thread scope when no threadId is provided', async () => {
      const toolset = createMockToolset({ getScope: vi.fn().mockReturnValue('thread') });
      toolsets.set('agent-1', toolset);

      const response = await app.request('http://localhost/api/agents/agent-1/browser/close', {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ success: true });
      expect(toolset.close).toHaveBeenCalledTimes(1);
      expect(toolset.closeThreadSession).not.toHaveBeenCalled();
    });

    it('tolerates a missing or invalid request body', async () => {
      const toolset = createMockToolset({ getScope: vi.fn().mockReturnValue('shared') });
      toolsets.set('agent-1', toolset);

      const response = await app.request('http://localhost/api/agents/agent-1/browser/close', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ success: true });
      expect(toolset.close).toHaveBeenCalledTimes(1);
    });

    it('returns 500 when the toolset throws during close', async () => {
      const toolset = createMockToolset({
        getScope: vi.fn().mockReturnValue('shared'),
        close: vi.fn().mockRejectedValue(new Error('boom')),
      });
      toolsets.set('agent-1', toolset);

      // Silence the expected console.error from the handler so test output stays clean.
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await app.request('http://localhost/api/agents/agent-1/browser/close', {
        method: 'POST',
      });

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: 'Failed to close browser' });

      consoleErrorSpy.mockRestore();
    });
  });
});
