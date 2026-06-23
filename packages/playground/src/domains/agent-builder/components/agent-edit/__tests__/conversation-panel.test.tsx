import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AgentColorProvider } from '../../../contexts/agent-color-context';
import { CREATE_SKILL_TOOL_NAME } from '../../../hooks/use-create-skill-tool';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import {
  SET_AGENT_BROWSER_ENABLED_TOOL_NAME,
  SET_AGENT_DESCRIPTION_TOOL_NAME,
  SET_AGENT_INSTRUCTIONS_TOOL_NAME,
  SET_AGENT_MODEL_TOOL_NAME,
  SET_AGENT_NAME_TOOL_NAME,
  SET_AGENT_SKILLS_TOOL_NAME,
  SET_AGENT_TOOLS_TOOL_NAME,
  SET_AGENT_WORKSPACE_ID_TOOL_NAME,
} from '../../../services/tool-constants';
import type { AgentTool } from '../../../types/agent-tool';
import { ConversationPanel } from '../conversation-panel';
import { authDisabledCapabilities, emptyThreadMessages, openAiOnlyModels } from './fixtures/conversation';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-test';
const BUILDER_THREAD_ID = `agent-builder-${AGENT_ID}`;

type Features = {
  tools: boolean;
  memory: boolean;
  workflows: boolean;
  agents: boolean;
  avatarUpload: boolean;
  skills: boolean;
  model: boolean;
  favorites: boolean;
  browser: boolean;
};

const allOff: Features = {
  tools: false,
  memory: false,
  workflows: false,
  agents: false,
  avatarUpload: false,
  skills: false,
  model: false,
  favorites: false,
  browser: false,
};

type WireTool = { id?: string; description?: string };
type StreamBody = {
  memory?: { thread?: string };
  clientTools?: Record<string, WireTool>;
  instructions?: string;
  messages?: Array<{ content?: unknown }>;
};

/** Closes immediately so useChat completes without producing messages. */
const emptyStream = () =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });

const sseResponse = () =>
  new HttpResponse(emptyStream(), { status: 200, headers: { 'content-type': 'text/event-stream' } });

const toAgentTools = (tools: Array<{ id: string; description?: string; type?: AgentTool['type'] }>): AgentTool[] =>
  tools.map(t => ({
    id: t.id,
    name: t.id,
    description: t.description,
    isChecked: false,
    type: t.type ?? 'tool',
  }));

const Wrapper = ({ children }: { children: ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: 'Initial', instructions: '', tools: {} },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter>
            <FormProvider {...methods}>
              <AgentColorProvider agentId={AGENT_ID}>{children}</AgentColorProvider>
            </FormProvider>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

interface RenderOptions {
  features?: Features;
  availableTools?: Array<{ id: string; description?: string; type?: AgentTool['type'] }>;
  availableWorkspaces?: Array<{ id: string; name: string }>;
}

const renderPanel = ({ features = allOff, availableTools = [], availableWorkspaces = [] }: RenderOptions = {}) =>
  render(
    <ConversationPanel
      initialUserMessage="hello"
      features={features}
      availableAgentTools={toAgentTools(availableTools)}
      availableWorkspaces={availableWorkspaces}
      agentId={AGENT_ID}
    />,
    { wrapper: Wrapper },
  );

/** Background queries the real ConversationPanel stack fires on mount. */
const mountHandlers = (modelsBody = openAiOnlyModels) => [
  http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabledCapabilities)),
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
  http.get(`${BASE_URL}/api/memory/threads/${BUILDER_THREAD_ID}/messages`, () =>
    HttpResponse.json(emptyThreadMessages),
  ),
  http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json(modelsBody)),
  http.get(`${BASE_URL}/api/tool-providers`, () => HttpResponse.json({ providers: [] })),
];

/** Captures the wire-serialized stream request body the panel auto-sends. */
const captureStream = () => {
  const bodies: StreamBody[] = [];
  server.use(
    ...mountHandlers(),
    http.post(`${BASE_URL}/api/agents/builder-agent/stream`, async ({ request }) => {
      bodies.push((await request.json()) as StreamBody);
      return sseResponse();
    }),
  );
  return bodies;
};

const captureStreamWith = (handlers: ReturnType<typeof mountHandlers>) => {
  const bodies: StreamBody[] = [];
  server.use(
    ...handlers,
    http.post(`${BASE_URL}/api/agents/builder-agent/stream`, async ({ request }) => {
      bodies.push((await request.json()) as StreamBody);
      return sseResponse();
    }),
  );
  return bodies;
};

const waitForSend = async (bodies: StreamBody[]) => {
  await waitFor(() => expect(bodies.length).toBeGreaterThan(0));
  return bodies[0];
};

beforeEach(() => {
  // The builder chat is local-only; suppress the thread signal subscription so
  // the only network call under test is the stream POST.
  (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS = 'false';
  server.resetHandlers();
});

afterEach(() => {
  delete (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS;
  cleanup();
});

describe('ConversationPanel', () => {
  describe('when rendered with the default (unfocused) composer', () => {
    it('uses the default border token styling', async () => {
      captureStream();
      const { getByTestId } = renderPanel();

      const composer = getByTestId('agent-builder-conversation-composer');
      expect(composer.className).toContain('border-border1');
      expect(composer.className).not.toContain('border-accent5Dark');
      expect(composer.className).not.toContain('focus-within:border-accent5');
    });
  });

  describe('when the panel auto-sends the starter message', () => {
    it('sends it on a builder-prefixed thread to the builder agent', async () => {
      const bodies = captureStream();
      await act(async () => {
        renderPanel();
      });

      const body = await waitForSend(bodies);
      expect(body.memory).toMatchObject({ thread: BUILDER_THREAD_ID });
    });

    it('flattens the form snapshot onto the top-level instructions field, not the visible message', async () => {
      const bodies = captureStream();
      await act(async () => {
        renderPanel({ features: { ...allOff, tools: true }, availableTools: [{ id: 'web-search' }] });
      });

      const body = await waitForSend(bodies);
      const instructions = body.instructions;
      expect(typeof instructions).toBe('string');
      expect(instructions).toContain('Current agent configuration');
      expect(instructions).toContain('"Initial"');
      const visible = JSON.stringify(body.messages ?? []);
      expect(visible).not.toContain('Current agent configuration');
    });
  });

  describe('when all features are off', () => {
    it('registers only the always-on per-field tools on the wire', async () => {
      const bodies = captureStream();
      await act(async () => {
        renderPanel();
      });

      const { clientTools = {} } = await waitForSend(bodies);
      expect(clientTools[SET_AGENT_NAME_TOOL_NAME]).toBeDefined();
      expect(clientTools[SET_AGENT_DESCRIPTION_TOOL_NAME]).toBeDefined();
      expect(clientTools[SET_AGENT_INSTRUCTIONS_TOOL_NAME]).toBeDefined();
      expect(clientTools[SET_AGENT_WORKSPACE_ID_TOOL_NAME]).toBeDefined();
    });

    it('omits every feature-gated tool on the wire', async () => {
      const bodies = captureStream();
      await act(async () => {
        renderPanel();
      });

      const { clientTools = {} } = await waitForSend(bodies);
      expect(clientTools[SET_AGENT_TOOLS_TOOL_NAME]).toBeUndefined();
      expect(clientTools[SET_AGENT_SKILLS_TOOL_NAME]).toBeUndefined();
      expect(clientTools[SET_AGENT_MODEL_TOOL_NAME]).toBeUndefined();
      expect(clientTools[SET_AGENT_BROWSER_ENABLED_TOOL_NAME]).toBeUndefined();
      expect(clientTools[CREATE_SKILL_TOOL_NAME]).toBeUndefined();
    });
  });

  describe('when features.tools is on', () => {
    it('registers the set-agent-tools tool with available tool ids in its description', async () => {
      const bodies = captureStream();
      await act(async () => {
        renderPanel({
          features: { ...allOff, tools: true },
          availableTools: [
            { id: 'web-search', description: 'Search the web' },
            { id: 'http-fetch', description: 'Fetch a URL' },
          ],
        });
      });

      const { clientTools = {} } = await waitForSend(bodies);
      const tool = clientTools[SET_AGENT_TOOLS_TOOL_NAME];
      expect(tool).toBeDefined();
      expect(tool.description).toContain('web-search');
      expect(tool.description).toContain('Search the web');
      expect(tool.description).toContain('http-fetch');
      expect(tool.description).toContain('Fetch a URL');
    });
  });

  describe('when features.model is on', () => {
    it('registers the set-agent-model tool listing only policy-allowed models', async () => {
      const bodies = captureStream();
      await act(async () => {
        renderPanel({ features: { ...allOff, model: true } });
      });

      const { clientTools = {} } = await waitForSend(bodies);
      const tool = clientTools[SET_AGENT_MODEL_TOOL_NAME];
      expect(tool).toBeDefined();
      expect(tool.description).toContain('Available models');
      expect(tool.description).toContain('provider: openai (OpenAI), name: gpt-4o');
      expect(tool.description).not.toContain('anthropic');
    });

    it('omits the set-agent-model tool when no models survive the policy filter', async () => {
      const bodies = captureStreamWith(mountHandlers({ providers: [] }));
      await act(async () => {
        renderPanel({ features: { ...allOff, model: true } });
      });

      const { clientTools = {} } = await waitForSend(bodies);
      expect(clientTools[SET_AGENT_MODEL_TOOL_NAME]).toBeUndefined();
      expect(clientTools[SET_AGENT_NAME_TOOL_NAME]).toBeDefined();
    });
  });

  describe('when features.skills is on with a workspace available', () => {
    it('registers the createSkill tool on the wire', async () => {
      const bodies = captureStream();
      await act(async () => {
        renderPanel({ features: { ...allOff, skills: true }, availableWorkspaces: [{ id: 'ws-1', name: 'Primary' }] });
      });

      const { clientTools = {} } = await waitForSend(bodies);
      expect(clientTools[CREATE_SKILL_TOOL_NAME]).toBeDefined();
      expect(clientTools[CREATE_SKILL_TOOL_NAME].id).toBe(CREATE_SKILL_TOOL_NAME);
    });

    it('omits the set-agent-skills tool when no skills are available', async () => {
      const bodies = captureStream();
      await act(async () => {
        renderPanel({ features: { ...allOff, skills: true }, availableWorkspaces: [{ id: 'ws-1', name: 'Primary' }] });
      });

      const { clientTools = {} } = await waitForSend(bodies);
      expect(clientTools[SET_AGENT_SKILLS_TOOL_NAME]).toBeUndefined();
      expect(clientTools[SET_AGENT_NAME_TOOL_NAME]).toBeDefined();
    });
  });

  describe('when features.browser is on', () => {
    it('registers the set-agent-browser-enabled tool on the wire', async () => {
      const bodies = captureStream();
      await act(async () => {
        renderPanel({ features: { ...allOff, browser: true } });
      });

      const { clientTools = {} } = await waitForSend(bodies);
      expect(clientTools[SET_AGENT_BROWSER_ENABLED_TOOL_NAME]).toBeDefined();
    });
  });
});
