import { createOpenAI } from '@ai-sdk/openai-v7';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { Agent } from '../../agent';
import type { ToolsInput } from '../../agent/types';
import { MockMemory } from '../../memory/mock';
import type { ActionRunOptions } from '../agent-options';
import type { MastraAction, PersistableAction } from '../types';

/** One AIMock server per suite; fixtures and the request journal reset between tests. */
export function useActionAimock(): () => LLMock {
  let mock: LLMock | undefined;
  beforeAll(async () => {
    mock = new LLMock({ port: 0 });
    await mock.start();
  });
  afterEach(() => {
    mock?.clearFixtures();
    mock?.clearRequests();
    mock?.resetMatchCounts();
  });
  afterAll(async () => {
    await mock?.stop();
  });
  return () => {
    if (!mock) throw new Error('Call useActionAimock() at suite scope');
    return mock;
  };
}

let counter = 0;

export function createActionAgent(
  llm: LLMock,
  opts: { tools?: ToolsInput; instructions?: string; memory?: MockMemory } = {},
) {
  const openai = createOpenAI({ apiKey: 'test', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
  const memory = opts.memory ?? new MockMemory();
  const agent = new Agent({
    id: `action-agent-${++counter}`,
    name: 'action-agent',
    instructions: opts.instructions ?? 'You are a test agent.',
    model: openai.chat('gpt-4o-mini'),
    tools: opts.tools ?? {},
    memory,
  });
  return { agent, memory };
}

export type ActionScenarioResult = {
  runId: string;
  streamed: MastraAction[];
  stored: PersistableAction[];
  types: string[];
};

/** Drains a run output and returns streamed actions plus everything stored for the thread so far. */
export async function drainRun(
  output: { runId: string; fullStream: AsyncIterable<MastraAction> },
  memory: MockMemory,
  threadId: string,
): Promise<ActionScenarioResult> {
  const streamed: MastraAction[] = [];
  for await (const action of output.fullStream) streamed.push(action);
  const stored = await memory.listActions({ threadId });
  return { runId: output.runId, streamed, stored, types: streamed.filter(a => !a.transient).map(a => a.type) };
}

export async function runScenario(
  agent: Agent,
  memory: MockMemory,
  input: Parameters<Agent['stream']>[0],
  options: ActionRunOptions & { thread?: string } = {},
): Promise<ActionScenarioResult> {
  const thread = options.thread ?? `thread-${++counter}`;
  const output = await agent.__streamActions(input, { ...options, memory: { thread, resource: 'user-1' } });
  const result = await drainRun(output, memory, thread);
  expectStorageInvariant(result);
  return result;
}

/** Storage holds exactly the persistable streamed actions of this run, never transient ones. */
export function expectStorageInvariant({ runId, streamed, stored }: ActionScenarioResult) {
  expect(stored.some(a => (a as MastraAction).transient)).toBe(false);
  expect(stored.filter(a => a.runId === runId).map(a => a.id)).toEqual(
    streamed.filter(a => !a.transient).map(a => a.id),
  );
}

/** Messages array the model received on the Nth chat request. */
export function requestMessages(llm: LLMock, index: number): Array<Record<string, any>> {
  return (llm.getRequests()[index]?.body as { messages?: Array<Record<string, any>> })?.messages ?? [];
}
