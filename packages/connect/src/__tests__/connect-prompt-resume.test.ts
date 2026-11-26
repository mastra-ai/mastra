import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { connectPromptResumeSchema } from '../connect-prompt-tool.js';
import { __clearSharedToolsStateForTests, tools as connect } from '../tools.js';

const RESOURCE_ID = 'end-user-42';

function linearConnection(resourceId: string | null) {
  return {
    id: 'c_lin1',
    integrationId: 'linear',
    status: 'active',
    connectedByUserId: null,
    connectedAt: '2026-09-01T00:00:00Z',
    createdAt: '2026-09-01T00:00:00Z',
    accountLabel: null,
    resourceId,
  };
}

/** Mastra Platform with a Linear catalog entry and a mutable connection list. */
function platform(connections: () => Array<Record<string, unknown>>, catalog: () => string[] = () => ['linear']) {
  const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname === '/v2/integrations') {
      return Response.json({
        integrations: catalog().map(id => ({ id, capabilities: {}, displayName: 'Linear', authType: 'OAUTH2' })),
      });
    }
    if (url.pathname === '/v2/projects/proj_1/integration-settings') {
      return Response.json({ endUserProviders: null });
    }
    const resourceId = url.searchParams.get('resourceId');
    return Response.json({
      connections: connections().filter(row => row.resourceId === null || row.resourceId === resourceId),
    });
  });
  return {
    projectId: 'proj_1',
    resourceId: RESOURCE_ID,
    client: { accessToken: 'fake-test-token', baseUrl: 'https://example.test', fetch: fetchMock as typeof fetch },
  };
}

/** Model that calls `request_connection` with `input` on its first step and answers on its second. */
function connectionRequestingModel(input: string) {
  const prompts: unknown[] = [];
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      const chunks =
        prompts.length === 1
          ? [
              {
                type: 'tool-call' as const,
                toolCallId: 'call-1',
                toolName: 'request_connection',
                input,
                providerExecuted: false,
              },
              {
                type: 'finish' as const,
                finishReason: 'tool-calls' as const,
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-start' as const, id: 't' },
              { type: 'text-delta' as const, id: 't', delta: 'Listing your issues.' },
              { type: 'text-end' as const, id: 't' },
              {
                type: 'finish' as const,
                finishReason: 'stop' as const,
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([{ type: 'stream-start' as const, warnings: [] }, ...chunks]),
      };
    },
  });
  return { model, prompts };
}

async function agentWithConnectTools(
  connections: () => Array<Record<string, unknown>>,
  requestInput = '{"provider":"linear"}',
  catalog?: () => string[],
) {
  const { model, prompts } = connectionRequestingModel(requestInput);
  const agent = new Agent({
    id: 'connect-agent',
    name: 'Connect Agent',
    instructions: 'Use Linear.',
    model,
    tools: await connect(platform(connections, catalog))(),
  });
  new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });
  return { agent, prompts };
}

afterEach(async () => {
  await __clearSharedToolsStateForTests();
});

describe('request_connection under an agent', () => {
  describe('when the requested provider is not connected yet', () => {
    it('pauses the run on the connect prompt instead of finishing the turn', async () => {
      const { agent, prompts } = await agentWithConnectTools(() => []);

      const stream = await agent.stream('List my Linear issues');
      const suspended: unknown[] = [];
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'tool-call-suspended') suspended.push(chunk.payload.suspendPayload);
      }

      expect(suspended).toEqual([
        expect.objectContaining({
          type: 'connect-prompt',
          requestedProvider: 'linear',
          providers: [expect.objectContaining({ id: 'linear', connected: false })],
        }),
      ]);
      // The model is not called again until the user connects.
      expect(prompts).toHaveLength(1);
    });

    it('tells the model the connection succeeded once resumed after the user connects', async () => {
      let rows: Array<Record<string, unknown>> = [];
      const { agent } = await agentWithConnectTools(() => rows);
      const stream = await agent.stream('List my Linear issues');
      for await (const _chunk of stream.fullStream) {
        // drain until the run suspends
      }

      rows = [linearConnection(RESOURCE_ID)];
      const resumed = await agent.resumeStream(
        { provider: 'linear', status: 'active' },
        { runId: stream.runId, toolCallId: 'call-1' },
      );
      let result: unknown;
      let text = '';
      for await (const chunk of resumed.fullStream) {
        if (chunk.type === 'tool-result') result = chunk.payload.result;
        if (chunk.type === 'text-delta') text += chunk.payload.text;
      }

      expect(result).toEqual(
        expect.objectContaining({
          type: 'connect-prompt',
          message: 'Linear connected successfully.',
          providers: [expect.objectContaining({ id: 'linear', connected: true, scope: 'user' })],
        }),
      );
      expect(text).toBe('Listing your issues.');
    });

    it('does not report success when the platform has no active connection', async () => {
      const { agent } = await agentWithConnectTools(() => []);
      const stream = await agent.stream('List my Linear issues');
      for await (const _chunk of stream.fullStream) {
        // drain until the run suspends
      }

      const resumed = await agent.resumeStream(
        { provider: 'linear', status: 'active' },
        { runId: stream.runId, toolCallId: 'call-1' },
      );
      let result: unknown;
      for await (const chunk of resumed.fullStream) {
        if (chunk.type === 'tool-result') result = chunk.payload.result;
      }

      expect(result).toEqual(expect.objectContaining({ message: 'Linear is not connected yet.' }));
    });

    it('tells the model why the connection failed when resumed with the error', async () => {
      const { agent } = await agentWithConnectTools(() => []);
      const stream = await agent.stream('List my Linear issues');
      for await (const _chunk of stream.fullStream) {
        // drain until the run suspends
      }

      const resumed = await agent.resumeStream(
        { provider: 'linear', status: 'failed', error: 'The authorization window was closed.' },
        { runId: stream.runId, toolCallId: 'call-1' },
      );
      let result: unknown;
      for await (const chunk of resumed.fullStream) {
        if (chunk.type === 'tool-result') result = chunk.payload.result;
      }

      expect(result).toEqual(
        expect.objectContaining({
          message: 'Linear could not be connected: The authorization window was closed.',
          error: 'The authorization window was closed.',
          providers: [expect.objectContaining({ id: 'linear', connected: false })],
        }),
      );
    });

    it('reports the platform state over a reported failure that raced a successful connection', async () => {
      let rows: Array<Record<string, unknown>> = [];
      const { agent } = await agentWithConnectTools(() => rows);
      const stream = await agent.stream('List my Linear issues');
      for await (const _chunk of stream.fullStream) {
        // drain until the run suspends
      }

      rows = [linearConnection(RESOURCE_ID)];
      const resumed = await agent.resumeStream(
        { provider: 'linear', status: 'failed', error: 'Timed out waiting for authorization.' },
        { runId: stream.runId, toolCallId: 'call-1' },
      );
      let result: unknown;
      for await (const chunk of resumed.fullStream) {
        if (chunk.type === 'tool-result') result = chunk.payload.result;
      }

      expect(result).toEqual(expect.objectContaining({ message: 'Linear connected successfully.' }));
      expect(result).not.toHaveProperty('error');
    });
  });

  describe('when the requested provider is already connected', () => {
    it('answers right away without pausing the run', async () => {
      const { agent } = await agentWithConnectTools(() => [linearConnection(null)]);

      const stream = await agent.stream('List my Linear issues');
      const types: string[] = [];
      for await (const chunk of stream.fullStream) types.push(chunk.type);

      expect(types).not.toContain('tool-call-suspended');
      expect(types).toContain('tool-result');
    });
  });

  describe('when the agent names no provider', () => {
    it('lists the connectable providers without pausing the run', async () => {
      const { agent } = await agentWithConnectTools(() => [], '{}');

      const stream = await agent.stream('Connect something');
      const types: string[] = [];
      for await (const chunk of stream.fullStream) types.push(chunk.type);

      expect(types).not.toContain('tool-call-suspended');
      expect(types).toContain('tool-result');
    });
  });

  describe('when the agent names a provider that is not connectable', () => {
    it('lists the connectable providers without pausing the run, so the agent can correct itself', async () => {
      const { agent } = await agentWithConnectTools(() => [], '{"provider":"linaer"}');

      const stream = await agent.stream('List my Linear issues');
      const types: string[] = [];
      for await (const chunk of stream.fullStream) types.push(chunk.type);

      expect(types).not.toContain('tool-call-suspended');
      expect(types).toContain('tool-result');
    });
  });

  describe('when resumed with a card action outside a channel thread', () => {
    async function resumeWith(action: 'connect' | 'check' | 'cancel', rows: Array<Record<string, unknown>> = []) {
      const { agent } = await agentWithConnectTools(() => rows);
      const stream = await agent.stream('List my Linear issues');
      const firstPause: unknown[] = [];
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'tool-call-suspended') firstPause.push(chunk.payload.suspendPayload);
      }
      const resumed = await agent.resumeStream({ action }, { runId: stream.runId, toolCallId: 'call-1' });
      const types: string[] = [];
      let result: unknown;
      for await (const chunk of resumed.fullStream) {
        types.push(chunk.type);
        if (chunk.type === 'tool-result') result = chunk.payload.result;
      }
      return { firstPause, types, result };
    }

    it('shows no channel card on the first pause', async () => {
      const { firstPause } = await resumeWith('cancel');
      expect(firstPause).toEqual([expect.not.objectContaining({ channelCard: expect.anything() })]);
    });

    it('finishes as cancelled on cancel', async () => {
      const { result } = await resumeWith('cancel');
      expect(result).toEqual(
        expect.objectContaining({
          message: 'Linear could not be connected: The user cancelled connecting.',
          error: 'The user cancelled connecting.',
        }),
      );
    });

    it('reports a connection the user made elsewhere on cancel', async () => {
      const rows: Array<Record<string, unknown>> = [];
      const { agent } = await agentWithConnectTools(() => rows);
      const stream = await agent.stream('List my Linear issues');
      for await (const _chunk of stream.fullStream) {
        // drain until the run suspends
      }
      rows.push(linearConnection(RESOURCE_ID));
      const resumed = await agent.resumeStream({ action: 'cancel' }, { runId: stream.runId, toolCallId: 'call-1' });
      let result: unknown;
      for await (const chunk of resumed.fullStream) {
        if (chunk.type === 'tool-result') result = chunk.payload.result;
      }
      expect(result).toEqual(expect.objectContaining({ message: 'Linear connected successfully.' }));
      expect(result).not.toHaveProperty('error');
    });

    it.each(['check', 'connect'] as const)(
      'finishes as failed on %s when the provider left the catalog while paused',
      async action => {
        let catalog = ['linear'];
        const { agent } = await agentWithConnectTools(
          () => [],
          undefined,
          () => catalog,
        );
        const stream = await agent.stream('List my Linear issues');
        for await (const _chunk of stream.fullStream) {
          // drain until the run suspends
        }
        catalog = [];
        const resumed = await agent.resumeStream({ action }, { runId: stream.runId, toolCallId: 'call-1' });
        let result: unknown;
        for await (const chunk of resumed.fullStream) {
          if (chunk.type === 'tool-result') result = chunk.payload.result;
        }
        expect(result).toEqual(
          expect.objectContaining({
            message: 'linear could not be connected: It is no longer available to connect.',
            error: 'It is no longer available to connect.',
          }),
        );
      },
    );

    it('keeps waiting on check before any sign-in started', async () => {
      const { types } = await resumeWith('check');
      expect(types).toContain('tool-call-suspended');
      expect(types).not.toContain('tool-result');
    });

    it('starts no sign-in on connect, since nobody can be sent the link', async () => {
      const { types } = await resumeWith('connect');
      expect(types).toContain('tool-call-suspended');
      // This fake platform has no session route, so starting one would fail the call.
      expect(types).not.toContain('tool-error');
      expect(types).not.toContain('tool-result');
    });
  });
});

describe('connectPromptResumeSchema', () => {
  it.each([
    { provider: 'linear', status: 'active' },
    { provider: 'linear', status: 'failed', error: 'The authorization window was closed.' },
    { action: 'connect' },
    { action: 'check' },
    { action: 'cancel' },
  ])('accepts %j', resume => {
    expect(connectPromptResumeSchema.parse(resume)).toEqual(resume);
  });

  it.each([{ provider: 'linear', status: 'failed' }, { provider: '', status: 'active' }, { action: 'open' }, {}])(
    'rejects %j',
    resume => {
      expect(connectPromptResumeSchema.safeParse(resume).success).toBe(false);
    },
  );
});
