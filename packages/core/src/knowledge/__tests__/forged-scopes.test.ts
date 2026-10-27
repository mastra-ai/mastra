import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../../agent';
import { MASTRA_SCOPE_ACCESS_KEY } from '../../agent/scopes';
import { Mastra } from '../../mastra';
import { MASTRA_SCOPES_KEY, RequestContext } from '../../request-context';
import { MastraServerBase } from '../../server/base';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Knowledge } from '../index';

type Call = { toolName: string; input: unknown };

function scriptedModel(calls: Call[]) {
  let step = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      const call = calls[step++];
      const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
      if (!call) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage,
          content: [{ type: 'text' as const, text: 'Done.' }],
          warnings: [],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'tool-calls' as const,
        usage,
        content: [
          {
            type: 'tool-call' as const,
            toolCallId: `call-${step}`,
            toolName: call.toolName,
            input: JSON.stringify(call.input),
          },
        ],
        warnings: [],
      };
    },
  });
}

function toolErrors(result: Awaited<ReturnType<Agent['generate']>>): string[] {
  return result.steps.flatMap(step =>
    step.content.flatMap((part: any) =>
      part.type === 'tool-result' && part.output?.type === 'error-text' ? [String(part.output.value)] : [],
    ),
  );
}

/** A tool standing in for any code inside the run that rewrites the run's request context. */
const tamper = createTool({
  id: 'tamper',
  description: 'Rewrites the run request context.',
  inputSchema: {
    type: 'object',
    properties: { action: { type: 'string', enum: ['delete-access', 'forge-scopes'] } },
    required: ['action'],
  },
  execute: async (input, context) => {
    const { action } = input as { action: string };
    const requestContext = context?.requestContext as RequestContext;
    if (action === 'delete-access') requestContext.delete(MASTRA_SCOPE_ACCESS_KEY);
    else requestContext.set(MASTRA_SCOPES_KEY, ['org:self', 'team:self:x']);
    return { ok: true };
  },
});

async function nodesAt(knowledge: Knowledge, scope: string[]) {
  const store = await knowledge.getStorage();
  return store.listNodes({ scope, limit: 50 });
}

describe('Knowledge tools with tampered or forged run scopes', () => {
  it('refuses a read-only tag after code inside the run deletes the access map', async () => {
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'tamper-delete' }), tools: { write: true } });
    const agent = new Agent({
      id: 'member',
      name: 'member',
      instructions: 'x',
      model: scriptedModel([
        { toolName: 'tamper', input: { action: 'delete-access' } },
        {
          toolName: 'knowledge_record',
          input: { op: 'add', node: 'Org note', kind: 'doc', text: 'y', scope: ['org:self'] },
        },
      ]),
      knowledge,
      tools: { tamper },
      scopes: [{ tag: 'org:self', access: 'read' }, 'team:self:x'],
    });

    const result = await agent.generate('go', { maxSteps: 3, memory: { thread: 'm-1', resource: 'member' } });

    expect(toolErrors(result)).toEqual(['This run does not hold scope "org:self".']);
    expect(await nodesAt(knowledge, ['org:self'])).toEqual([]);
  });

  it('gives knowledge tools nothing when code inside the run writes its own mastra__scopes', async () => {
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'tamper-forge' }), tools: { write: true } });
    const agent = new Agent({
      id: 'no-memory',
      name: 'no-memory',
      instructions: 'x',
      model: scriptedModel([
        { toolName: 'tamper', input: { action: 'forge-scopes' } },
        { toolName: 'knowledge_record', input: { op: 'add', node: 'Forged', kind: 'doc', text: 'y' } },
        { toolName: 'knowledge_search', input: { query: 'Forged' } },
      ]),
      knowledge,
      tools: { tamper },
      scopes: ['agent:alex'],
    });

    const result = await agent.generate('go', { maxSteps: 4 });

    const needScopes =
      'Knowledge tools need run scopes: give the agent or the call `scopes`, or run it with a Memory resource or thread.';
    expect(toolErrors(result)).toEqual([needScopes, needScopes]);
    expect(await nodesAt(knowledge, ['org:self', 'team:self:x'])).toEqual([]);
  });

  it('refuses request-context scopes behind a server that predates agent scopes, before any tool runs', async () => {
    class OutdatedServer extends MastraServerBase {}
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'outdated' }), tools: { write: true } });
    const agent = new Agent({
      id: 'agent',
      name: 'agent',
      instructions: 'x',
      model: scriptedModel([
        { toolName: 'knowledge_record', input: { op: 'add', node: 'Victim', kind: 'doc', text: 'y' } },
      ]),
      knowledge,
    });
    const mastra = new Mastra({ agents: { agent }, logger: false });
    mastra.setMastraServer(new OutdatedServer({ app: {} }));

    const requestContext = new RequestContext([[MASTRA_SCOPES_KEY, ['org:victim']]]);
    await expect(mastra.getAgent('agent').generate('go', { requestContext, maxSteps: 2 })).rejects.toMatchObject({
      id: 'AGENT_SCOPES_SERVER_OUTDATED',
    });
    expect(await nodesAt(knowledge, ['org:victim'])).toEqual([]);
  });
});
