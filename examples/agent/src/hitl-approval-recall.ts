/**
 * HITL tool-approval recall round-trip demo — issue #17218
 * https://github.com/mastra-ai/mastra/issues/17218
 *
 * Run with:
 *   pnpm --dir examples/agent hitl:approval
 *   # or: npx tsx src/hitl-approval-recall.ts   (from examples/agent)
 *
 * What it shows
 * -------------
 * When a `requireApproval` tool call is approved or declined, the LIVE stream was always
 * correct — but the PERSISTED messages used to lose the decision. This script drives the
 * real agentic loop (deterministic mock model, no API key needed), persists to LibSQL, then
 * recalls and projects to AI SDK v6 UI parts — the exact path a frontend takes on reload.
 *
 * Historically (the bug):
 *   - Decline → recalled part was `state: 'output-available'`, `output: 'Tool call was not
 *     approved by the user'`, NO `approval`. Indistinguishable from a tool that succeeded and
 *     happened to return that string.
 *   - Approve → recalled part was `state: 'output-available'` with the output but NO `approval`.
 *
 * Fixed (expected now):
 *   - Decline → `state: 'output-denied'` + `approval: { approved: false, reason }`.
 *   - Approve → `state: 'output-available'` + `approval: { approved: true }`.
 *
 * Because it touches the agentic loop, eyeball the LIVE-stream section too: the tool must still
 * suspend for approval, the declined tool must NOT execute, and the approved tool MUST execute.
 */
import { rm } from 'node:fs/promises';
import { Agent, convertMessages } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { z } from 'zod';

const DB_FILE = 'hitl-approval-recall.db';
const DB_URL = `file:${DB_FILE}`;
const RESOURCE_ID = 'demo-user';
const DECLINE_REASON = 'Tool call was not approved by the user';

// A tool that requires human approval before it runs. `execute` is only ever reached on approval.
let toolExecuteCount = 0;
const findUserTool = createTool({
  id: 'findUserTool',
  description: 'Look up a user by name and return their email.',
  inputSchema: z.object({ name: z.string() }),
  requireApproval: true,
  execute: async input => {
    toolExecuteCount++;
    return { name: input.name, email: `${input.name.toLowerCase().replace(/\s+/g, '.')}@example.com` };
  },
});

/**
 * Deterministic model: first call asks to call findUserTool; every later call (after the approval
 * decision) returns a short text response so the loop can finish. A fresh instance per flow keeps
 * the call counter isolated.
 */
function createMockModel() {
  let callCount = 0;
  return new MastraLanguageModelV2Mock({
    provider: 'mock',
    modelId: 'mock-hitl',
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-hitl',
                timestamp: new Date(),
              });
              controller.enqueue({
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'findUserTool',
                input: JSON.stringify({ name: 'Dero Israel' }),
                providerExecuted: false,
              });
              controller.enqueue({
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              });
              controller.close();
            },
          }),
        };
      }
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'response-metadata', id: 'id-1', modelId: 'mock-hitl', timestamp: new Date() });
            controller.enqueue({ type: 'text-start', id: 'text-0' });
            controller.enqueue({ type: 'text-delta', id: 'text-0', delta: 'All done — let me know if you need more.' });
            controller.enqueue({ type: 'text-end', id: 'text-0' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            });
            controller.close();
          },
        }),
      };
    },
  });
}

function buildAgent(memory: Memory, storage: LibSQLStore) {
  const agent = new Agent({
    id: 'hitl-agent',
    name: 'HITL Agent',
    instructions: 'You look up users. Use findUserTool, which requires approval before it runs.',
    model: createMockModel(),
    tools: { findUserTool },
    memory,
  });
  // Registering with a Mastra that has storage lets the agent persist/load the suspend snapshot,
  // which approveToolCall()/declineToolCall() need to resume the run.
  const mastra = new Mastra({ agents: { hitlAgent: agent }, storage, logger: false });
  return mastra.getAgent('hitlAgent');
}

async function runFlow(decision: 'approve' | 'decline', memory: Memory, storage: LibSQLStore) {
  const agent = buildAgent(memory, storage);
  const threadId = `thread-${decision}`;
  toolExecuteCount = 0;

  // 1) Stream until the loop suspends for approval.
  const stream = await agent.stream('Find the user named Dero Israel', {
    memory: { resource: RESOURCE_ID, thread: { id: threadId } },
  });

  let toolCallId = '';
  let sawApprovalRequest = false;
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call-approval') {
      sawApprovalRequest = true;
      toolCallId = chunk.payload.toolCallId;
    }
  }

  // 2) Approve or decline — this resumes the run.
  const resume =
    decision === 'approve'
      ? await agent.approveToolCall({ runId: stream.runId, toolCallId })
      : await agent.declineToolCall({ runId: stream.runId, toolCallId });
  for await (const _chunk of resume.fullStream) {
    // drain so the resumed turn finishes persisting
  }

  // 3) Recall from storage and project to AI SDK v6 UI parts (what a frontend sees on reload).
  const { messages } = await memory.recall({ threadId, resourceId: RESOURCE_ID, perPage: false });

  const storedInvocation = messages
    .flatMap(m => m.content.parts ?? [])
    .find((p: any) => p.type === 'tool-invocation' && p.toolInvocation?.toolCallId === toolCallId) as any;

  const v6Part = convertMessages(messages)
    .to('AIV6.UI')
    .flatMap(m => m.parts)
    .find((p: any) => 'toolCallId' in p && p.toolCallId === toolCallId) as any;

  // The agent's onFinish memory-save builds AI SDK v4 core messages. A declined approval is stored
  // as `output-denied`, which v4 has no concept of — this conversion used to throw "ToolInvocation
  // must have a result" (issue #17218 follow-up). Exercise it directly so the demo guards it.
  let v4CoreError: string | undefined;
  try {
    convertMessages(messages).to('AIV4.Core');
  } catch (err) {
    v4CoreError = err instanceof Error ? err.message : String(err);
  }

  return {
    threadId,
    sawApprovalRequest,
    toolExecuted: toolExecuteCount > 0,
    stored: storedInvocation?.toolInvocation,
    v6Part,
    v4CoreError,
  };
}

function reportFlow(label: string, r: Awaited<ReturnType<typeof runFlow>>) {
  console.log(`\n${'─'.repeat(72)}\n${label}  (thread: ${r.threadId})\n${'─'.repeat(72)}`);
  console.log('LIVE  | suspended for approval :', r.sawApprovalRequest);
  console.log('LIVE  | tool actually executed :', r.toolExecuted);
  console.log('STORE | MastraDB invocation    :', JSON.stringify(r.stored, null, 2));
  console.log('V6 UI | recalled tool part     :', JSON.stringify(r.v6Part, null, 2));
  console.log('V4    | core conversion error  :', r.v4CoreError ?? '(none)');
}

async function main() {
  // Fresh DB each run so recall reflects only this run.
  await Promise.all([DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`].map(f => rm(f, { force: true })));

  const storage = new LibSQLStore({ id: 'hitl-approval-recall', url: DB_URL });
  const memory = new Memory({ storage });

  console.log('HITL tool-approval recall round-trip — issue #17218');

  const declined = await runFlow('decline', memory, storage);
  reportFlow('DECLINE', declined);

  const approved = await runFlow('approve', memory, storage);
  reportFlow('APPROVE', approved);

  // Assertions: print a clear PASS/FAIL so this doubles as a manual smoke test.
  console.log(`\n${'═'.repeat(72)}\nRESULT\n${'═'.repeat(72)}`);
  const checks: Array<[string, boolean]> = [
    ['decline suspended for approval', declined.sawApprovalRequest === true],
    ['decline did NOT execute the tool', declined.toolExecuted === false],
    ['decline stored state === "output-denied"', declined.stored?.state === 'output-denied'],
    ['decline stored approval.approved === false', declined.stored?.approval?.approved === false],
    ['decline stored approval.reason carries the message', declined.stored?.approval?.reason === DECLINE_REASON],
    ['decline v6 part state === "output-denied"', declined.v6Part?.state === 'output-denied'],
    ['decline v6 part approval.approved === false', declined.v6Part?.approval?.approved === false],
    ['decline AIV4.Core conversion does not throw', declined.v4CoreError === undefined],
    ['approve suspended for approval', approved.sawApprovalRequest === true],
    ['approve DID execute the tool', approved.toolExecuted === true],
    ['approve stored state === "result"', approved.stored?.state === 'result'],
    ['approve stored approval.approved === true', approved.stored?.approval?.approved === true],
    ['approve v6 part state === "output-available"', approved.v6Part?.state === 'output-available'],
    ['approve v6 part approval.approved === true', approved.v6Part?.approval?.approved === true],
    ['approve AIV4.Core conversion does not throw', approved.v4CoreError === undefined],
  ];

  let allPass = true;
  for (const [name, ok] of checks) {
    if (!ok) allPass = false;
    console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${name}`);
  }
  console.log(
    `\n${allPass ? '✅ All checks passed — approvals round-trip on recall.' : '❌ Some checks failed (the historical bug, or a regression).'}`,
  );

  process.exit(allPass ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
