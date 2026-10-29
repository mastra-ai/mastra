import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../../agent';
import { MASTRA_SCOPE_ACCESS_KEY } from '../../agent/scopes';
import { Mastra } from '../../mastra';
import { MASTRA_SCOPES_KEY, RequestContext } from '../../request-context';
import { MastraServerBase } from '../../server/base';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';

const scopes = {
  ...knowledgeMemoryScopes({ org: 'org:$orgId' }),
  'team:$orgId:$teamId': { access: [{ principal: 'self' as const, role: 'editor' as const }] },
  'agent:$agentId': { access: [{ principal: 'self' as const, role: 'owner' as const }] },
};

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

/** Every live page, read as the host. */
async function allPages(knowledge: Knowledge) {
  const store = await knowledge.getStorage();
  return (await store.listPages({ read: 'all', limit: 50 })).pages.map(page => `${page.scopeId}:${page.name}`);
}

describe('Knowledge tools with tampered or forged run scopes', () => {
  it('holds only the Memory identity after code inside the run deletes the access map', async () => {
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'tamper-delete' }), scopes, tools: true });
    const agent = new Agent({
      id: 'member',
      name: 'member',
      instructions: 'x',
      model: scriptedModel([
        { toolName: 'tamper', input: { action: 'delete-access' } },
        { toolName: 'knowledge_page', input: { op: 'write', scope: 'org:self', name: 'Org note' } },
      ]),
      knowledge,
      tools: { tamper },
      scopes: [
        { scope: 'org:self', access: 'read' },
        { scope: 'team:self:x', access: 'write' },
      ],
    });

    const result = await agent.generate('go', { maxSteps: 3, memory: { thread: 'm-1', resource: 'member' } });

    expect(toolErrors(result)).toEqual(['Knowledge page "org:self" not found.']);
    expect(await allPages(knowledge)).toEqual([]);
  });

  it('gives knowledge tools nothing when code inside the run writes its own mastra__scopes', async () => {
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'tamper-forge' }), scopes, tools: true });
    const agent = new Agent({
      id: 'no-memory',
      name: 'no-memory',
      instructions: 'x',
      model: scriptedModel([
        { toolName: 'tamper', input: { action: 'forge-scopes' } },
        { toolName: 'knowledge_page', input: { op: 'write', scope: 'team:self:x', name: 'Forged' } },
        { toolName: 'knowledge_search', input: { query: 'Forged' } },
      ]),
      knowledge,
      tools: { tamper },
      scopes: [{ scope: 'agent:alex', access: 'write' }],
    });

    const result = await agent.generate('go', { maxSteps: 4 });

    expect(toolErrors(result)).toHaveLength(2);
    expect(await allPages(knowledge)).toEqual([]);
  });

  it('refuses request-context scopes behind a server that predates agent scopes, before any tool runs', async () => {
    class OutdatedServer extends MastraServerBase {}
    const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'outdated' }), scopes, tools: true });
    const agent = new Agent({
      id: 'agent',
      name: 'agent',
      instructions: 'x',
      model: scriptedModel([
        { toolName: 'knowledge_page', input: { op: 'write', scope: 'org:victim', name: 'Victim' } },
      ]),
      knowledge,
    });
    const mastra = new Mastra({ agents: { agent }, logger: false });
    mastra.setMastraServer(new OutdatedServer({ app: {} }));

    const requestContext = new RequestContext([[MASTRA_SCOPES_KEY, ['org:victim']]]);
    await expect(mastra.getAgent('agent').generate('go', { requestContext, maxSteps: 2 })).rejects.toMatchObject({
      id: 'AGENT_SCOPES_SERVER_OUTDATED',
    });
    expect(await allPages(knowledge)).toEqual([]);
  });
});
