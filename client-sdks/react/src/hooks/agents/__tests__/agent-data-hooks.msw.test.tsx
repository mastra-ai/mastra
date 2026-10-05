// @vitest-environment jsdom
import type {
  ChannelPlatformInfo,
  ListAgentVersionsResponse,
  ListAgentsModelProvidersResponse,
  StoredAgentResponse,
  ListStoredAgentsResponse,
  ListStoredSkillsResponse,
} from '@mastra/client-js';
import { act, cleanup, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../test/render';
import { isModelNotAllowedError } from '../is-model-not-allowed';
import { useAgentSkills } from '../use-agent-skills';
import { useAgentVersions } from '../use-agent-versions';
import { useAgentWorkingMemory } from '../use-agent-working-memory';
import { useAgentWorkspace } from '../use-agent-workspace';
import { useAgentsModelProviders } from '../use-agents-model-providers';
import { useChannelPlatforms, useDisconnectChannel } from '../use-channels';
import { useCloseBrowser } from '../use-close-browser';
import { useExecuteAgentTool } from '../use-execute-agent-tool';
import { usePreviewInstructions } from '../use-preview-instructions';
import { useStoredAgents } from '../use-stored-agents';
import { useStoredSkills } from '../use-stored-skills';

const API = `${TEST_BASE_URL}/api`;

const providers: ListAgentsModelProvidersResponse = { providers: [] };
const storedAgents: ListStoredAgentsResponse = { agents: [], total: 0, page: 0, perPage: 20, hasMore: false };
const storedSkills: ListStoredSkillsResponse = { skills: [], total: 0, page: 0, perPage: 20, hasMore: false };
const versions: ListAgentVersionsResponse = { versions: [], total: 0, page: 0, perPage: 20, hasMore: false };
const storedAgent: StoredAgentResponse = {
  id: 'agent-1',
  status: 'draft',
  createdAt: '2026-10-02T00:00:00Z',
  updatedAt: '2026-10-02T00:00:00Z',
  name: 'Agent',
  instructions: 'Help',
  model: { provider: 'openai', name: 'gpt-4o' },
  skills: { 'skill-1': {} },
  workspace: { type: 'id', workspaceId: 'ws-1' },
};
const platforms: ChannelPlatformInfo[] = [];

afterEach(() => cleanup());

describe('useAgentsModelProviders', () => {
  describe('when the server lists providers', () => {
    it('returns the providers response', async () => {
      server.use(http.get(`${API}/agents/providers`, () => HttpResponse.json(providers)));
      const { result } = renderHookWithProviders(() => useAgentsModelProviders());
      await waitFor(() => expect(result.current.data).toEqual(providers));
    });
  });
});

describe('useStoredAgents', () => {
  describe('when the server lists stored agents', () => {
    it('returns the stored agents page', async () => {
      server.use(http.get(`${API}/stored/agents`, () => HttpResponse.json(storedAgents)));
      const { result } = renderHookWithProviders(() => useStoredAgents());
      await waitFor(() => expect(result.current.data).toEqual(storedAgents));
    });
  });
});

describe('useStoredSkills', () => {
  describe('when the server lists stored skills', () => {
    it('returns the stored skills page', async () => {
      server.use(http.get(`${API}/stored/skills`, () => HttpResponse.json(storedSkills)));
      const { result } = renderHookWithProviders(() => useStoredSkills());
      await waitFor(() => expect(result.current.data).toEqual(storedSkills));
    });
  });
});

describe('useChannelPlatforms', () => {
  describe('when the server lists channel platforms', () => {
    it('returns the platforms', async () => {
      server.use(http.get(`${API}/channels/platforms`, () => HttpResponse.json(platforms)));
      const { result } = renderHookWithProviders(() => useChannelPlatforms());
      await waitFor(() => expect(result.current.data).toEqual(platforms));
    });
  });
});

describe('useExecuteAgentTool', () => {
  describe('when the tool runs', () => {
    it('posts the input and resolves the tool result', async () => {
      let body: unknown;
      server.use(
        http.post(`${API}/agents/agent-1/tools/tool-1/execute`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ ok: true });
        }),
      );
      const { result } = renderHookWithProviders(() => useExecuteAgentTool());
      let response: unknown;
      await act(async () => {
        response = await result.current.mutateAsync({ agentId: 'agent-1', toolId: 'tool-1', input: { q: 'hi' } });
      });
      expect(response).toEqual({ ok: true });
      expect(body).toMatchObject({ data: { q: 'hi' } });
    });
  });
});

describe('useCloseBrowser', () => {
  describe('when the browser is closed', () => {
    it('posts to the agent browser close endpoint', async () => {
      let called = false;
      server.use(
        http.post(`${API}/agents/agent-1/browser/close`, () => {
          called = true;
          return HttpResponse.json({ success: true });
        }),
      );
      const { result } = renderHookWithProviders(() => useCloseBrowser());
      await act(async () => {
        await result.current.mutateAsync({ agentId: 'agent-1', threadId: 'thread-1' });
      });
      expect(called).toBe(true);
    });
  });
});

describe('usePreviewInstructions', () => {
  describe('when blocks are provided', () => {
    it('returns the resolved instructions', async () => {
      server.use(
        http.post(`${API}/stored/agents/preview-instructions`, () => HttpResponse.json({ result: 'Be helpful' })),
      );
      const { result } = renderHookWithProviders(() =>
        usePreviewInstructions([{ type: 'text', content: 'Be helpful' }], true),
      );
      await waitFor(() => expect(result.current.data).toBe('Be helpful'));
    });
  });
});

describe('useAgentWorkingMemory', () => {
  describe('when the thread has markdown working memory', () => {
    it('exposes the stored working memory', async () => {
      server.use(
        http.get(`${API}/memory/threads/thread-1/working-memory`, () =>
          HttpResponse.json({
            workingMemory: '# Notes',
            source: 'thread',
            workingMemoryTemplate: { content: '', format: 'markdown' },
            threadExists: true,
          }),
        ),
      );
      const { result } = renderHookWithProviders(() => useAgentWorkingMemory('agent-1', 'thread-1', 'resource-1'));
      await waitFor(() => expect(result.current.workingMemoryData).toBe('# Notes'));
    });
  });
});

describe('isModelNotAllowedError', () => {
  describe('when the error is a 422 MODEL_NOT_ALLOWED response', () => {
    it('returns the parsed details', () => {
      const err = { status: 422, body: { error: { code: 'MODEL_NOT_ALLOWED', message: 'Blocked' } } };
      expect(isModelNotAllowedError(err)).toEqual({
        message: 'Blocked',
        attempted: undefined,
        offendingLabel: undefined,
      });
    });
  });
});

describe('useAgentVersions', () => {
  describe('when the stored agent has versions', () => {
    it('returns the versions page', async () => {
      server.use(http.get(`${API}/stored/agents/agent-1/versions`, () => HttpResponse.json(versions)));
      const { result } = renderHookWithProviders(() => useAgentVersions({ agentId: 'agent-1' }));
      await waitFor(() => expect(result.current.data).toEqual(versions));
    });
  });
});

describe('useDisconnectChannel', () => {
  describe('when the agent is disconnected', () => {
    it('posts to the platform disconnect endpoint', async () => {
      let called = false;
      server.use(
        http.post(`${API}/channels/slack/agent-1/disconnect`, () => {
          called = true;
          return HttpResponse.json({ success: true });
        }),
      );
      const { result } = renderHookWithProviders(() => useDisconnectChannel('slack'));
      await act(async () => {
        await result.current.mutateAsync('agent-1');
      });
      expect(called).toBe(true);
    });
  });
});

describe('useAgentSkills', () => {
  describe('when the draft agent has skills', () => {
    it('exposes the skills map', async () => {
      server.use(http.get(`${API}/stored/agents/agent-1`, () => HttpResponse.json(storedAgent)));
      const { result } = renderHookWithProviders(() => useAgentSkills('agent-1'));
      await waitFor(() => expect(result.current.skills).toEqual({ 'skill-1': {} }));
    });
  });
});

describe('useAgentWorkspace', () => {
  describe('when the draft agent references a workspace', () => {
    it('exposes the workspace ref', async () => {
      server.use(http.get(`${API}/stored/agents/agent-1`, () => HttpResponse.json(storedAgent)));
      const { result } = renderHookWithProviders(() => useAgentWorkspace('agent-1'));
      await waitFor(() => expect(result.current.workspace).toEqual({ type: 'id', workspaceId: 'ws-1' }));
    });
  });
});
