import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  runLoopScenario,
  useLoopScenarioAimock,
} from '../aimock-scenario';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

// #27445: a storage reader must still find the resumed run until its final reply is persisted.
describeForAllEngines('Resumed run snapshot finalization', engine => {
  const getMock = useLoopScenarioAimock();
  const answer = 'Your refund has been completed.';
  const threadId = 'refund-thread';
  const resourceId = 'refund-customer';

  for (const kind of ['approval', 'suspend'] as const) {
    for (const rejectSave of [false, true]) {
      it(`${kind}: retains snapshots during final save and ${rejectSave ? 'reports a rejected save' : 'cleans up after persistence'} (#27445)`, async () => {
        const memory = new MockMemory();
        const refund = createTool({
          id: 'refund',
          description: 'Refund the order.',
          inputSchema: z.object({}),
          requireApproval: kind === 'approval',
          suspendSchema: z.object({ question: z.string() }),
          resumeSchema: z.object({ approved: z.boolean() }),
          execute: async (_input, context) => {
            if (kind === 'suspend' && !context?.agent?.resumeData) {
              return await context?.agent?.suspend({ question: 'Refund?' });
            }
            return { receipt: 'REFUND_RECEIPT_4821' };
          },
        });
        const shared = await createSharedAgent(getMock(), { engine, tools: { refund }, memory });
        const { output, chunks } = await runLoopScenario({
          engine, llm: getMock(), sharedAgent: shared, prompt: 'Refund my order',
          memory, threadId, resourceId, stopWhen: stepCountIs(3), collectChunks: true,
          fixtures: llm => {
            llm.on({ endpoint: 'chat', hasToolResult: false }, {
              toolCalls: [{ id: 'refund-call', name: 'refund', arguments: {} }],
            });
            llm.on({ endpoint: 'chat', hasToolResult: true }, { content: answer });
          },
        });
        expect(chunks?.some(chunk => chunk.type === (kind === 'approval' ? 'tool-call-approval' : 'tool-call-suspended'))).toBe(true);
        const workflows = await shared.mastra.getStorage().getStore('workflows');
        const outerName = isDurableEngineVariant(engine) ? 'durable-agentic-loop' : 'agentic-loop';
        const getSnapshot = () => workflows.loadWorkflowSnapshot({ workflowName: outerName, runId: output.runId });
        expect(await getSnapshot()).not.toBeNull();

        const store = await memory.storage.getStore('memory');
        if (!store) throw new Error('Missing memory store');
        const saveMessages = store.saveMessages.bind(store);
        const saving = deferred();
        const release = deferred();
        let intercepted = false;
        store.saveMessages = async args => {
          if (JSON.stringify(args.messages).includes(answer)) {
            intercepted = true;
            saving.resolve();
            await release.promise;
            if (rejectSave) throw new Error('final reply storage unavailable');
          }
          return saveMessages(args);
        };
        const received: ChunkType[] = [];
        let streamError: unknown;
        let finished = false;
        const resumed = await shared.agent.resumeStream({ approved: true }, {
          runId: output.runId, toolCallId: 'refund-call', memory: { thread: threadId, resource: resourceId },
        });
        const drain = (async () => {
          try {
            for await (const chunk of resumed.fullStream) received.push(chunk);
          } catch (error) { streamError = error; }
          finally { finished = true; }
        })();
        try {
          await Promise.race([
            saving.promise,
            drain.then(() => { if (!intercepted) throw new Error('Stream ended without saving final reply'); }),
          ]);
          expect(finished).toBe(false);
          expect(await getSnapshot(), 'run vanished while its final save was pending').not.toBeNull();
          const before = await memory.recall({ threadId, resourceId });
          expect(JSON.stringify(before.messages)).not.toContain(answer);
        } finally {
          release.resolve();
          await drain;
          store.saveMessages = saveMessages;
        }
        if (rejectSave) {
          expect(received.some(chunk => chunk.type === 'finish')).toBe(false);
          expect(streamError || received.find(chunk => chunk.type === 'error')).toBeTruthy();
          expect(JSON.stringify((await memory.recall({ threadId, resourceId })).messages)).not.toContain(answer);
        } else {
          expect(streamError).toBeUndefined();
          expect(received.some(chunk => chunk.type === 'finish')).toBe(true);
          const saved = JSON.stringify((await memory.recall({ threadId, resourceId })).messages);
          expect(saved).toContain(answer);
          expect(saved).toContain('REFUND_RECEIPT_4821');
          await expect.poll(getSnapshot).toBeNull();
        }
      });
    }
  }
});
