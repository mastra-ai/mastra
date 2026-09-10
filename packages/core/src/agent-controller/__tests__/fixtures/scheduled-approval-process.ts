import assert from 'node:assert/strict';
import fs from 'node:fs';
import { z } from 'zod';
import { Memory } from '../../../../../../packages/memory/src/index.js';
import { LibSQLStore } from '../../../../../../stores/libsql/src/index.js';
import { createDurableAgent } from '../../../../dist/agent/durable/index.js';
import { Agent } from '../../../../dist/agent/index.js';
import { AgentController } from '../../../../dist/agent-controller/index.js';
import { Mastra } from '../../../../dist/mastra/index.js';
import { MastraLanguageModelV2Mock } from '../../../../dist/test-utils/llm-mock.js';
import { createTool } from '../../../../dist/tools/index.js';

const [phase, policy, db, expectedRunId] = process.argv.slice(2);
globalThis.fetch = async () => {
  throw new Error('External network is forbidden in this proof');
};
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const storage = new LibSQLStore({ id: 'scheduled-restart', url: `file:${db}` });
const memory = new Memory({ storage, options: { generateTitle: false } });
let calls = 0,
  executions = 0;
const model = new MastraLanguageModelV2Mock({
  doStream: async () => {
    calls++;
    const toolCall = calls === 1;
    return {
      stream: new ReadableStream({
        start(c) {
          c.enqueue({ type: 'stream-start', warnings: [] });
          if (toolCall)
            c.enqueue({
              type: 'tool-call',
              toolCallId: phase === 'prepare' ? 'first' : 'second',
              toolName: 'fixture',
              input: '{"value":"saved"}',
            });
          else {
            c.enqueue({ type: 'text-start', id: 'answer' });
            c.enqueue({ type: 'text-delta', id: 'answer', delta: 'Completed.' });
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
const agent = createDurableAgent({
  agent: new Agent({
    id: 'scheduled-agent',
    name: 'Scheduled proof',
    instructions: 'Use fixture.',
    model,
    memory,
    tools: {
      fixture: createTool({
        id: 'fixture',
        description: 'Local action',
        inputSchema: z.object({ value: z.string() }),
        execute: async input => {
          assert.equal(input.value, 'saved');
          executions++;
          fs.appendFileSync(`${db}.actions`, 'action\n');
          return { ok: true };
        },
      }),
    },
  }),
});
const controller = new AgentController({
  id: 'scheduled-controller',
  agent: agent as unknown as Agent,
  storage,
  memory,
  modes: [{ id: 'chat', name: 'Chat', default: true }],
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
const mastra = new Mastra({
  agents: { agent },
  agentControllers: { controller },
  storage,
  logger: false,
  recovery: { durableAgents: 'off' },
});
await controller.init();
const scope = { resourceId: 'owner', threadId: 'result' };
if (phase === 'prepare') {
  await memory.createThread({ threadId: scope.threadId, resourceId: scope.resourceId });
  const session = await controller.createSession({ ...scope, scope: 'thread:result' });
  await session.state.set({ yolo: true });
  if (policy === 'blocked') await session.permissions.setForTool({ toolName: 'fixture', policy: 'deny' });
  // Exit after the actual durable approval save, before it can be published or
  // consumed. The new process cannot inherit Session, PubSub or run state.
  const workflows = (await storage.getStore('workflows'))!;
  const persist = workflows.persistWorkflowSnapshot.bind(workflows);
  const saves: unknown[] = [];
  workflows.persistWorkflowSnapshot = async args => {
    const result = await persist(args);
    const snapshot = typeof args.snapshot === 'string' ? JSON.parse(args.snapshot) : (args.snapshot as any);
    saves.push({
      name: args.workflowName,
      status: snapshot?.status,
      input: Object.keys(snapshot?.context?.input ?? {}),
      context: Object.keys(snapshot?.context ?? {}),
    });
    if (
      args.workflowName === 'durable-agentic-loop' &&
      snapshot.status === 'suspended' &&
      snapshot.context?.input?.options?.toolApprovalContext
    ) {
      const saved = await agent.listSuspendedRuns(scope);
      assert.equal(saved.total, 1);
      assert.equal(executions, 0);
      const savedRun = saved.runs[0];
      const savedCall = savedRun?.toolCalls[0];
      assert.ok(savedRun && savedCall);
      console.info(
        'RESULT ' +
          JSON.stringify({
            pid: process.pid,
            runId: savedRun.runId,
            executions,
            calls,
            policy: savedCall.toolApprovalPolicy,
          }),
      );
      process.exit(0);
    }
    return result;
  };
  const schedule = await mastra.schedules.create({
    agentId: agent.id,
    ...scope,
    name: 'Restart proof',
    prompt: 'Use fixture.',
    cron: '0 9 * * *',
    timezone: 'Asia/Riyadh',
    status: 'paused',
    ifActive: { behavior: 'discard' },
    ifIdle: {
      behavior: 'wake',
      streamOptions: {
        toolApprovalPolicy: policy === 'manual' ? 'manual' : 'auto',
        controllerTarget: { controllerId: controller.id, scope: 'thread:result' },
      },
    },
  });
  await mastra.startWorkers();
  await mastra.schedules.run(schedule.id);
  await wait(15000);
  throw new Error(
    `Approval was not durably saved before the deadline (model calls: ${calls}, actions: ${executions}, saves: ${JSON.stringify(saves)})`,
  );
}

// No createSession or browser request: the native recovery API must reconnect
// the saved controller target itself.
const recovered = await agent.recoverActiveRuns(phase === 'targeted' ? { runId: expectedRunId } : {});
assert.equal(recovered.failed, 0);
assert.deepEqual(recovered.restoredApprovals, [expectedRunId]);
const session = await controller.getSessionByResource('owner', 'thread:result');
assert.ok(session);
assert.deepEqual(session.permissions.getRules(), { tools: {}, categories: {} });
if (policy === 'manual') {
  assert.equal(calls, 0);
  assert.equal(executions, 0);
  for (const toolCallId of ['first', 'second']) {
    for (let i = 0; i < 200 && session.displayState.get().pendingApproval?.toolCallId !== toolCallId; i++)
      await wait(25);
    assert.equal(session.displayState.get().pendingApproval?.toolCallId, toolCallId);
    session.respondToToolApproval({ decision: 'approve', toolCallId });
  }
}
for (let i = 0; i < 300 && (calls < 2 || session.run.isRunning()); i++) await wait(25);
assert.equal(calls, 2);
assert.equal(executions, policy === 'blocked' ? 0 : 2);
assert.equal((await agent.listSuspendedRuns(scope)).total, 0);
assert.equal(session.displayState.get().pendingApproval, null);
console.info('RESULT ' + JSON.stringify({ pid: process.pid, runId: expectedRunId, executions, calls }));
await mastra.shutdown();
process.exit(0);
