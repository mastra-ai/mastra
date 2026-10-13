import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import {
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_SCOPES_KEY,
  MASTRA_THREAD_ID_KEY,
  RequestContext,
} from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Hono } from 'hono';
import { MastraServer } from '../index';

/**
 * Sentinel §5: agent-scope security contracts exercised through the REAL HTTP
 * routes (Hono MastraServer adapter + app.request), not handler unit mocks.
 *
 * 1. Identity scopes (`resource:`/`thread:`) never reach tool execution context —
 *    a knowledge-style tool must see only non-identity scopes in `mastra__scopes`.
 * 2. A request body can never pick the Knowledge resource: body `scopes` is
 *    stripped by the handlers, and every reserved request-context key (scopes,
 *    identity, user, permissions, auth, memory, tenant — see RESERVED_KEYS
 *    below) in body `requestContext` is dropped individually by the server
 *    adapter before the agent runs, while non-reserved keys flow through.
 */

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function stream(parts: unknown[]) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

/** First call asks for `toolName`, later calls answer with text. */
function toolCallingModel(toolName: string) {
  let calls = 0;
  return new MastraLanguageModelV2Mock({
    doGenerate: async () => {
      calls++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        usage,
        ...(calls === 1
          ? {
              finishReason: 'tool-calls' as const,
              content: [{ type: 'tool-call' as const, toolCallId: `call-${calls}`, toolName, input: '{}' }],
            }
          : { finishReason: 'stop' as const, content: [{ type: 'text' as const, text: 'done' }] }),
      };
    },
    doStream: async () => {
      calls++;
      const parts =
        calls === 1
          ? [
              { type: 'tool-call', toolCallId: `call-${calls}`, toolName, input: '{}' },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : [
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'done' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage },
            ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: stream([{ type: 'stream-start', warnings: [] }, ...parts]) as any,
      };
    },
  });
}

/**
 * Mirrors RESERVED_CONTEXT_KEYS in packages/server/src/server/constants.ts.
 * Every one of these is forged in a request body below and must never reach
 * the tool's request context. If the server adds a reserved key, add it here.
 */
const RESERVED_KEYS = [
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
  MASTRA_SCOPES_KEY,
  'mastra__user',
  'mastra__userPermissions',
  'mastra__userRoles',
  'mastra__authToken',
  'mastra__isStudio',
  'mastra__authMode',
  'mastra__inheritedMemory',
  'mastra__factoryMemorySettings',
  'organizationId',
] as const;

type ToolSighting = {
  scopes: unknown;
  /** Reserved keys present in the tool-visible request context. Must stay empty. */
  reservedLeaks: string[];
  /** Non-reserved body requestContext entries must still flow through. */
  harmless: unknown;
  /** The run's resolved memory identity, as the tool sees it. */
  runResourceId: unknown;
  runThreadId: unknown;
};

function buildApp(agentScopes?: string[]) {
  const sightings: ToolSighting[] = [];
  const knowledgeTool = createTool({
    id: 'knowledge-tool',
    description: 'Captures the request context a knowledge tool would read scopes from',
    inputSchema: z.object({}),
    execute: (_input, context) => {
      // Memory identity lands on the nested agent execution context, which the
      // generic createTool context type does not surface.
      const agentContext = (context as typeof context & { agent?: { threadId?: string; resourceId?: string } })
        .agent;
      const requestContext = (context?.requestContext ?? new RequestContext()) as RequestContext;
      sightings.push({
        scopes: requestContext.get(MASTRA_SCOPES_KEY),
        reservedLeaks: RESERVED_KEYS.filter(key => requestContext.get(key) !== undefined),
        harmless: requestContext.get('harmless'),
        runResourceId: agentContext?.resourceId,
        runThreadId: agentContext?.threadId,
      });
      return Promise.resolve({ ok: true });
    },
  });

  const agent = new Agent({
    id: 'scoped-agent',
    name: 'Scoped Agent',
    instructions: 'Test agent',
    model: toolCallingModel('knowledgeTool'),
    tools: { knowledgeTool },
    memory: new MockMemory({ storage: new InMemoryStore() }),
    ...(agentScopes ? { scopes: agentScopes } : {}),
  });

  const mastra = new Mastra({ agents: { 'scoped-agent': agent }, logger: false });
  return { mastra, sightings };
}

function generateRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/agents/scoped-agent/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'go' }],
      ...body,
    }),
  });
}

describe('agent scope security over real server routes', () => {
  it('hands tools only non-identity scopes in mastra__scopes', async () => {
    const { mastra, sightings } = buildApp(['org:acme', 'resource:res-1', 'thread:t-1']);
    const app = await serve(mastra);

    const response = await app.request(generateRequest({}));

    expect(response.status).toBe(200);
    expect(sightings).toHaveLength(1);
    // The run's identity scopes must not be visible to the tool: only the
    // non-identity scope survives into the derived tool context. The identity
    // itself still reaches the tool as the resolved memory identity.
    expect(sightings[0]!.scopes).toEqual(['org:acme']);
    expect(sightings[0]!.runResourceId).toBe('res-1');
    expect(sightings[0]!.runThreadId).toBe('t-1');
  });

  it('strips body scopes and reserved requestContext keys before the agent runs', async () => {
    const { mastra, sightings } = buildApp();
    const app = await serve(mastra);

    const forgedContext: Record<string, unknown> = { harmless: 'kept' };
    for (const key of RESERVED_KEYS) forgedContext[key] = `forged-${key}`;
    forgedContext[MASTRA_SCOPES_KEY] = ['org:evil'];

    const response = await app.request(
      generateRequest({
        scopes: ['org:evil', 'resource:evil-res', 'thread:evil-thread'],
        requestContext: forgedContext,
      }),
    );

    expect(response.status).toBe(200);
    expect(sightings).toHaveLength(1);
    // Every reserved key must be dropped individually — a regression that
    // selectively lets one through must fail here.
    expect(sightings[0]!.reservedLeaks).toEqual([]);
    expect(sightings[0]!.scopes).toBeUndefined();
    expect(sightings[0]!.runResourceId).toBeUndefined();
    expect(sightings[0]!.runThreadId).toBeUndefined();
    // Non-reserved body request context still flows through: the filter is
    // selective, not a wholesale drop of the body context.
    expect(sightings[0]!.harmless).toBe('kept');
  });

  it('never lets a body-supplied scope override the agent-configured identity', async () => {
    const { mastra, sightings } = buildApp(['org:acme', 'resource:res-1', 'thread:t-1']);
    const app = await serve(mastra);

    const response = await app.request(
      generateRequest({
        scopes: ['resource:evil-res'],
        requestContext: { [MASTRA_SCOPES_KEY]: ['resource:evil-res'] },
      }),
    );

    // Body input is stripped rather than merged, so the run keeps the configured
    // identity instead of conflicting or adopting the forged resource. The
    // resolved memory identity the tool runs under must be the configured one.
    expect(response.status).toBe(200);
    expect(sightings).toHaveLength(1);
    expect(sightings[0]!.scopes).toEqual(['org:acme']);
    expect(sightings[0]!.runResourceId).toBe('res-1');
    expect(sightings[0]!.runThreadId).toBe('t-1');
  });
});

async function serve(mastra: Mastra) {
  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  return app;
}
