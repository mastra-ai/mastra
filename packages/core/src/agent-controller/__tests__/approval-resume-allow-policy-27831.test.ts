/**
 * #27831: an AgentController run that goes through a tool approval.
 *
 * 1. A tool resolved by an `allow` policy is resumed exactly once: the run finishes and no
 *    `AGENT_RESUME_ALREADY_CLAIMED` reaches the user.
 * 2. A mode's `availableTools` keeps applying after the approval: the model is never offered a
 *    tool outside the mode, before or after the continuation.
 *
 * The model is aimock; every request it receives is in the journal, so the tools offered on each
 * model call are read from what actually went over the wire.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../../agent';
import { agentThreadStreamRuntime } from '../../agent/thread-stream-runtime';
import { useLoopScenarioAimock } from '../../loop/test-utils/aimock/aimock-scenario';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage/mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

const getMock = useLoopScenarioAimock();

const toolResults = (req: ChatCompletionRequest) => req.messages.filter(message => message.role === 'tool').length;

/** read_data('a'), then read_data('b'), then answer. */
function scriptedModel() {
  const llm = getMock();
  llm.on(
    { endpoint: 'chat', predicate: req => toolResults(req) === 0 },
    { toolCalls: [{ id: 'call-a', name: 'read_data', arguments: { name: 'a' } }] },
  );
  llm.on(
    { endpoint: 'chat', predicate: req => toolResults(req) === 1 },
    { toolCalls: [{ id: 'call-b', name: 'read_data', arguments: { name: 'b' } }] },
  );
  llm.on({ endpoint: 'chat' }, { content: 'done' });
  return createOpenAI({ apiKey: 'aimock', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` })('gpt-4o-mini');
}

/** Tool names offered to the model on each chat request, in order. */
function toolsOfferedPerModelCall() {
  return getMock()
    .getRequests()
    .flatMap(entry => (entry.body && entry.body._endpointType === 'chat' ? [entry.body] : []))
    .map(body => (body.tools ?? []).map(tool => tool.function.name).sort());
}

async function setup({
  registeredOnMastra,
  availableTools,
}: {
  registeredOnMastra: boolean;
  availableTools?: string[];
}) {
  const reads: string[] = [];
  const writes: string[] = [];
  const readData = createTool({
    id: 'read_data',
    description: 'Reads a value by name.',
    inputSchema: z.object({ name: z.string() }),
    execute: async ({ name }) => {
      reads.push(name);
      return { name, value: `value-of-${name}` };
    },
  });
  const writeNote = createTool({
    id: 'write_note',
    description: 'Writes a note.',
    inputSchema: z.object({ text: z.string() }),
    requireApproval: true,
    execute: async ({ text }) => {
      writes.push(text);
      return { ok: true };
    },
  });
  const agent = new Agent({
    id: 'repro',
    name: 'Repro',
    instructions: 'Follow the request exactly.',
    model: scriptedModel(),
    tools: { read_data: readData, write_note: writeNote },
  });
  const storage = new InMemoryStore();
  const controller = new AgentController({
    id: 'repro-controller',
    workspace: createMockWorkspace(),
    agent,
    memory: new MockMemory({ storage: new InMemoryStore() }),
    modes: [{ id: 'only', name: 'Only', metadata: { default: true }, availableTools }],
    toolCategoryResolver: () => 'read',
    ...(registeredOnMastra ? {} : { storage }),
  });
  if (registeredOnMastra) {
    controller.__registerMastra(new Mastra({ logger: false, storage, agents: { repro: agent } }));
  }
  await controller.init();
  const session = await controller.createSession({ resourceId: 'repro', threadId: `thread-${Date.now()}` });
  await session.permissions.setForCategory({ category: 'read', policy: 'allow' });

  const events: AgentControllerEvent[] = [];
  session.subscribe(event => events.push(event));
  const errors = () => events.flatMap(event => (event.type === 'error' ? [event.error.message] : []));
  return { session, reads, writes, errors };
}

afterEach(() => {
  agentThreadStreamRuntime.resetForTests();
});

describe('AgentController approval resume (#27831)', () => {
  describe.each([
    { label: 'controller registered on a Mastra instance', registeredOnMastra: true },
    { label: 'standalone controller', registeredOnMastra: false },
  ])('$label', ({ registeredOnMastra }) => {
    it('an allow-policy tool call is resumed once and the run finishes', async () => {
      const env = await setup({ registeredOnMastra });

      await env.session.sendMessage({ content: "Call read_data with 'a', then with 'b', then answer 'done'." });

      expect(env.errors()).toEqual([]);
      expect(env.reads).toEqual(['a', 'b']);
      expect(toolsOfferedPerModelCall()).toHaveLength(3);
    }, 30_000);
  });

  it("a mode's availableTools still applies to the model call after an approved tool call", async () => {
    const env = await setup({ registeredOnMastra: true, availableTools: ['read_data'] });

    await env.session.sendMessage({ content: "Call read_data with 'a', then with 'b', then answer 'done'." });

    const offered = toolsOfferedPerModelCall();
    expect(offered.length).toBeGreaterThanOrEqual(2);
    // The first call is the mode's view; every later call must match it.
    expect(offered[0]).toEqual(['read_data']);
    expect(offered.filter(tools => tools.includes('write_note'))).toEqual([]);
    expect(env.writes).toEqual([]);
  }, 30_000);
});
