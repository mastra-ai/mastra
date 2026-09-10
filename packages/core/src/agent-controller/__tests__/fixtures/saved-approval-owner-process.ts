import assert from 'node:assert/strict';
import fs from 'node:fs';
import { z } from 'zod';
import { Memory } from '../../../../../../packages/memory/src/index.js';
import { LibSQLStore } from '../../../../../../stores/libsql/src/index.js';
import { createDurableAgent } from '../../../../dist/agent/durable/index.js';
import { Agent } from '../../../../dist/agent/index.js';
import { AgentController } from '../../../../dist/agent-controller/index.js';
import { InMemoryServerCache } from '../../../../dist/cache/index.js';
import { EventEmitterPubSub } from '../../../../dist/events/index.js';
import { Mastra } from '../../../../dist/mastra/index.js';
import { MastraLanguageModelV2Mock } from '../../../../dist/test-utils/llm-mock.js';
import { createTool } from '../../../../dist/tools/index.js';

const [phase, decision, db, expectedRunId] = process.argv.slice(2);
globalThis.fetch = async () => {
  throw new Error('Network is forbidden in this proof');
};
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let calls = 0,
  executions = 0;
const events: any[] = [];
const storage = new LibSQLStore({ id: 'approval-restart', url: `file:${db}` });
const memory = new Memory({ storage, options: { generateTitle: false } });
const model = new MastraLanguageModelV2Mock({
  doStream: async () => {
    calls++;
    const toolCall = phase === 'prepare';
    return {
      stream: new ReadableStream({
        start(c) {
          c.enqueue({ type: 'stream-start', warnings: [] });
          c.enqueue({ type: 'response-metadata', id: 'response', modelId: 'mock', timestamp: new Date(0) });
          if (toolCall)
            c.enqueue({
              type: 'tool-call',
              toolCallId: 'fixture-call',
              toolName: 'fixture',
              input: '{"value":"saved input"}',
              providerExecuted: false,
            });
          else {
            c.enqueue({ type: 'text-start', id: 'answer' });
            c.enqueue({ type: 'text-delta', id: 'answer', delta: 'Saved work completed.' });
            c.enqueue({ type: 'text-end', id: 'answer' });
          }
          c.enqueue({
            type: 'finish',
            finishReason: toolCall ? 'tool-calls' : 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          });
          c.close();
        },
      }),
    };
  },
});
const tool = createTool({
  id: 'fixture',
  description: 'A local approval fixture',
  inputSchema: z.object({ value: z.string() }),
  execute: async input => {
    executions++;
    assert.equal(input.value, 'saved input');
    fs.appendFileSync(`${db}.executions`, `${process.pid}\n`);
    return { ok: true };
  },
});
const cache = new InMemoryServerCache(),
  pubsub = new EventEmitterPubSub();
const agent = createDurableAgent({
  agent: new Agent({
    id: 'fixture-agent',
    name: 'Fixture',
    instructions: 'Use the fixture.',
    model,
    memory,
    tools: { fixture: tool },
  }),
  cache,
  pubsub,
});
const responseOwners: string[] = [];
const otherAgent = new Agent({
  id: 'other-mode-agent',
  name: 'Other mode',
  instructions: 'Do not handle the saved run.',
  memory,
  model: new MastraLanguageModelV2Mock({
    doStream: async () => {
      throw new Error('Other mode must not run');
    },
  }),
});
for (const owner of [agent, otherAgent]) {
  const send = owner.sendToolApproval.bind(owner);
  owner.sendToolApproval = async input => {
    responseOwners.push(owner.id);
    return send(input);
  };
}
const controller = new AgentController({
  id: 'fixture-controller',
  // DurableAgent intentionally changes stream/generate return types. This
  // fixture exercises the shared controller subscription API instead.
  agent: agent as unknown as Agent<any, any, any>,
  storage,
  memory,
  pubsub,
  modes: [
    { id: 'web', name: 'Web', default: true, agent: agent as unknown as Agent<any, any, any> },
    { id: 'other', name: 'Other', agent: otherAgent },
  ],
  disableBuiltinTools: [
    'ask_user',
    'submit_plan',
    'task_write',
    'task_update',
    'task_complete',
    'task_check',
    'subagent',
  ],
});
new Mastra({
  agents: { agent, otherAgent },
  agentControllers: { controller },
  storage,
  cache,
  pubsub,
  logger: false,
  workers: false,
  scheduler: { enabled: false },
  recovery: { durableAgents: 'off' },
});
await controller.init();
const scope = { resourceId: 'fixture-owner', threadId: 'fixture-thread' };
const session = await controller.createSession(scope);
session.subscribe(e => {
  if (['error', 'agent_end', 'tool_end', 'tool_approval_required'].includes(e.type))
    events.push({
      type: e.type,
      reason: e.type === 'agent_end' ? e.reason : undefined,
      error: e.type === 'error' ? e.error.message : undefined,
    });
});
if (phase !== 'prepare') {
  // Exercise the native owner-specific attachment boundary used by plan resume.
  // Switching the product mode must not change the owner of this saved run.
  await session.mode.switch({ modeId: 'other' });
  session.thread.cleanupSubscription();
  await session.thread.ensureSubscription(
    scope.threadId,
    agent as unknown as Parameters<typeof session.thread.ensureSubscription>[1],
  );
  console.info(
    'OWNER_BOUNDARY ' +
      JSON.stringify({
        mode: session.mode.get(),
        owner: agent.id,
        pending: session.displayState.get().pendingApproval,
        calls,
        executions,
        responseOwners,
        savedRunIds: (await agent.listSuspendedRuns(scope)).runs.map(run => run.runId),
      }),
  );
}
if (phase === 'prepare') {
  void session
    .sendMessage({ content: 'Use the fixture.' })
    .catch(e => events.push({ type: 'error', error: String(e) }));
  let saved;
  for (let i = 0; i < 100; i++) {
    saved = await agent.listSuspendedRuns(scope);
    if (saved.total === 1 && session.approval.isArmed()) break;
    await wait(50);
  }
  assert.equal(saved?.total, 1);
  const savedRun = saved?.runs[0];
  assert.ok(savedRun);
  const savedCall = savedRun.toolCalls[0];
  assert.ok(savedCall);
  assert.equal(executions, 0);

  console.info(
    'RESULT ' +
      JSON.stringify({
        phase,
        decision,
        pid: process.pid,
        calls,
        executions,
        runId: savedRun.runId,
        requiresApproval: savedCall.requiresApproval,
      }),
  );
  process.exit(0);
}
const saved = await agent.listSuspendedRuns(scope);
assert.equal(saved.total, 1);
const savedRun = saved.runs[0];
assert.ok(savedRun);
const savedCall = savedRun.toolCalls[0];
assert.ok(savedCall);
assert.equal(savedRun.runId, expectedRunId);
assert.equal(savedCall.requiresApproval, true);
assert.deepEqual(session.displayState.get().pendingApproval, {
  toolCallId: 'fixture-call',
  toolName: 'fixture',
  args: { value: 'saved input' },
});
assert.equal(session.approval.isArmed(), true);
await wait(150);
assert.equal(calls, 0);
assert.equal(executions, 0);
session.respondToToolApproval({ decision: 'approve', toolCallId: 'wrong-call' });
assert.equal(session.approval.isArmed(), true);
if (decision === 'message') {
  await assert.rejects(
    session.sendSignal({ content: 'Another message' }).accepted,
    /Respond to the saved tool approval/,
  );
  assert.equal(calls, 0);
  assert.equal(executions, 0);
  assert.equal(session.approval.isArmed(), true);
  assert.equal((await agent.listSuspendedRuns(scope)).total, 1);
  session.respondToToolApproval({ decision: 'decline', toolCallId: 'fixture-call' });
  for (let i = 0; i < 100 && !events.some(e => e.type === 'agent_end'); i++) await wait(50);
  assert.equal(executions, 0);
} else if (decision === 'navigate') {
  await session.thread.create({ id: 'another-thread' });
  session.respondToToolApproval({ decision: 'approve', toolCallId: 'fixture-call' });
  await wait(150);
  assert.equal(executions, 0);
  assert.equal(calls, 0);
  assert.equal((await agent.listSuspendedRuns(scope)).total, 1);
} else if (decision === 'stop') {
  session.abort();
  for (let i = 0; i < 100 && !events.some(e => e.type === 'agent_end'); i++) await wait(50);
  assert.equal((await agent.listSuspendedRuns(scope)).total, 0);
  assert.equal(executions, 0);
  assert.equal(calls, 0);
  assert.equal(events.filter(e => e.type === 'agent_end' && e.reason === 'aborted').length, 1);
} else {
  session.respondToToolApproval({ decision: decision as 'approve' | 'decline', toolCallId: 'fixture-call' });
  session.respondToToolApproval({ decision: 'approve', toolCallId: 'fixture-call' });
  for (let i = 0; i < 100 && !events.some(e => e.type === 'agent_end'); i++) await wait(50);
  assert.equal(executions, decision === 'approve' ? 1 : 0);
  assert.equal((await agent.listSuspendedRuns(scope)).total, 0);
  assert.equal(events.filter(e => e.type === 'agent_end').length, 1);
}
assert.deepEqual(responseOwners, ['fixture-agent']);
assert.equal(session.displayState.get().pendingApproval, null);
assert.deepEqual(
  events.filter(e => e.type === 'error'),
  [],
);
console.info(
  'RESULT ' +
    JSON.stringify({
      phase,
      decision,
      pid: process.pid,
      calls,
      executions,
      runId: savedRun.runId,
      events,
      responseOwners,
    }),
);
process.exit(0);
