import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { Processor } from '../../processors';
import { MASTRA_SCOPES_KEY, RequestContext } from '../../request-context';
import { MastraServerBase } from '../../server/base';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function textModel(text = 'ok') {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage,
      content: [{ type: 'text', text }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage },
      ]),
    }),
  });
}

/** First call asks for `toolName`, later calls answer with text. */
function toolCallingModel(toolName: string, input: Record<string, unknown> = {}) {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      const parts =
        calls === 1
          ? [
              { type: 'tool-call', toolCallId: `call-${calls}`, toolName, input: JSON.stringify(input) },
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
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as any),
      };
    },
  });
}

function scopeRecorder() {
  const seen: unknown[] = [];
  const processor: Processor = {
    id: 'scope-recorder',
    processInput: async ({ messages, requestContext }) => {
      seen.push(requestContext?.get(MASTRA_SCOPES_KEY));
      return messages;
    },
  };
  return { seen, processor };
}

/** A server released before agent scopes: it does not set `reservesAgentScopes`. */
class OutdatedServer extends MastraServerBase {}

class ScopesServer extends MastraServerBase {
  override readonly reservesAgentScopes = true;
}

function serverAdapter(reservesAgentScopes?: true): MastraServerBase {
  return reservesAgentScopes ? new ScopesServer({ app: {} }) : new OutdatedServer({ app: {} });
}

function setup(
  server: MastraServerBase | undefined,
  config: Partial<ConstructorParameters<typeof Agent>[0]> = {},
  extraAgents: Record<string, Agent> = {},
) {
  const recorder = scopeRecorder();
  const agent = new Agent({
    id: 'scoped-agent',
    name: 'Scoped Agent',
    instructions: 'Test',
    model: textModel(),
    memory: new MockMemory({ storage: new InMemoryStore() }),
    inputProcessors: [recorder.processor],
    ...config,
  } as ConstructorParameters<typeof Agent>[0]);
  const mastra = new Mastra({ agents: { agent, ...extraAgents }, logger: false });
  if (server) mastra.setMastraServer(server);
  return { agent: mastra.getAgent('agent'), seen: recorder.seen };
}

async function errorIdOf(run: Promise<unknown>) {
  try {
    await run;
  } catch (error: any) {
    return error.id;
  }
  return undefined;
}

describe('agent scopes behind a registered server', () => {
  it('refuses call and request-context scopes when the server predates agent scopes', async () => {
    const { agent, seen } = setup(serverAdapter());

    await expect(errorIdOf(agent.generate('x', { scopes: ['org:victim'] }))).resolves.toBe(
      'AGENT_SCOPES_SERVER_OUTDATED',
    );
    await expect(errorIdOf(agent.stream('x', { scopes: ['org:victim'] }))).resolves.toBe(
      'AGENT_SCOPES_SERVER_OUTDATED',
    );
    const requestContext = new RequestContext([[MASTRA_SCOPES_KEY, ['org:victim']]]);
    await expect(errorIdOf(agent.generate('x', { requestContext }))).resolves.toBe('AGENT_SCOPES_SERVER_OUTDATED');
    expect(seen).toEqual([]);

    // Runs without caller scopes are unaffected.
    await agent.generate('x', { memory: { resource: 'u1', thread: 't1' } });
    expect(seen).toEqual([undefined]);
  });

  it("still applies the Agent's own scopes behind an outdated server", async () => {
    const { agent, seen } = setup(serverAdapter(), { scopes: ['org:acme'] });
    await agent.generate('x');
    expect(seen).toEqual([['org:acme']]);
  });

  it('accepts caller scopes behind a server that reserves them, and with no server', async () => {
    for (const server of [serverAdapter(true), undefined]) {
      const { agent, seen } = setup(server);
      await agent.generate('x', { scopes: ['org:acme', 'resource:u1', 'thread:t1'] });
      await agent.generate('x', { requestContext: new RequestContext([[MASTRA_SCOPES_KEY, ['org:beta']]]) });
      expect(seen).toEqual([['org:acme'], ['org:beta']]);
    }
  });

  it('lets nested runs reuse scopes Core derived from the parent run behind an outdated server', async () => {
    const nested = scopeRecorder();
    const other = new Agent({
      id: 'other',
      name: 'Other',
      instructions: 'Test',
      model: textModel(),
      memory: new MockMemory({ storage: new InMemoryStore() }),
      inputProcessors: [nested.processor],
    });
    const child = scopeRecorder();
    const subAgent = new Agent({
      id: 'child',
      name: 'Child',
      description: 'child agent',
      instructions: 'Test',
      model: textModel('child answer'),
      inputProcessors: [child.processor],
    });
    const callOther = createTool({
      id: 'callOther',
      description: 'calls another agent',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        // Observational Memory's internal agents clone the context the same way.
        const cloned = new RequestContext(Array.from(context.requestContext!.entries()));
        await other.generate('nested', { requestContext: cloned, memory: { thread: 'other-thread', resource: 'u1' } });
        return { ok: true };
      },
    });

    const withTool = setup(
      serverAdapter(),
      { scopes: ['org:acme'], model: toolCallingModel('callOther'), tools: { callOther } },
      { other },
    );
    await (await withTool.agent.stream('go', { memory: { resource: 'u1', thread: 't1' } })).consumeStream();
    expect(nested.seen).toEqual([['org:acme']]);

    const withSubAgent = setup(serverAdapter(), {
      scopes: ['org:acme'],
      model: toolCallingModel('agent-child', { prompt: 'help' }),
      agents: { child: subAgent },
    });
    await (await withSubAgent.agent.stream('go')).consumeStream();
    expect(child.seen).toEqual([['org:acme']]);
  });

  it('still refuses a copied scopes array behind an outdated server', async () => {
    const { agent } = setup(serverAdapter(), { scopes: ['org:acme'] });
    // A JSON round trip, like a request body, loses Core's mark.
    const requestContext = new RequestContext([[MASTRA_SCOPES_KEY, JSON.parse(JSON.stringify(['org:acme']))]]);
    await expect(errorIdOf(agent.generate('x', { requestContext }))).resolves.toBe('AGENT_SCOPES_SERVER_OUTDATED');
  });
});
