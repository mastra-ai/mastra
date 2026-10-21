import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { AGENTIC_LOOP_WORKFLOW_ID } from '../../../loop-builder';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

describeForAllEngines('A stopped approval cannot restart a run (#27617)', engine => {
  const getMock = useLoopScenarioAimock();

  for (const [start, resumeAfter] of [
    ['stream', 'abort'],
    ['stream on a thread', 'abort'],
    ['stream', 'stream completion'],
    ['stream', 'stream completion with snapshot cleanup pending'],
    ['stream', 'stream completion with snapshot cleanup failed'],
    ['stream on a thread', 'abort during snapshot load with snapshot cleanup pending'],
    ['generate', 'abort'],
  ] as const) {
    // Only normal/fs approval-suspended streams close after abort here. Their agent path also
    // deletes and loads the suspended snapshot through the gates below.
    if (resumeAfter !== 'abort' && engine !== 'normal' && engine !== 'fs') {
      continue;
    }
    // Normal/fs generate runs are not registered for abortRunStream, which returns false.
    // Keep this separate cancellation limitation visible without expanding #27617.
    const test = start === 'generate' && (engine === 'normal' || engine === 'fs') ? it.fails : it;
    test.each(['approveToolCall', 'declineToolCall', 'resumeStream', 'resumeGenerate'] as const)(
      `%s rejects after aborting ${start} and waiting for ${resumeAfter} without executing the tool or requesting another model turn`,
      async method => {
        const llm = getMock();
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_abort', name: 'lookup_status', arguments: { query: 'alpha' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Should never be generated.' });
        const executed: string[] = [];
        const lookup = createTool({
          id: 'lookup_status',
          description: 'Look up a status.',
          inputSchema: z.object({ query: z.string() }),
          execute: async ({ query }) => {
            executed.push(query);
            return { status: `OK:${query}` };
          },
        });
        // A thread keeps the suspended run parked, so abortRunStream can still stop it while a resume is loading.
        const onThread = start === 'stream on a thread';
        const { agent, mastra } = await createSharedAgent(llm, {
          engine,
          tools: { lookup_status: lookup },
          ...(onThread ? { memory: new MockMemory() } : {}),
        });
        // Hold the real store's snapshot deletion open so the user responds inside the cleanup window.
        let releaseCleanup = () => {};
        let cleanupStarted: Promise<void> | undefined;
        if (resumeAfter.includes('snapshot cleanup')) {
          const workflows = (await mastra.getStorage()!.getStore('workflows'))!;
          const deleteRun = workflows.deleteWorkflowRunById.bind(workflows);
          const gate = new Promise<void>(resolve => (releaseCleanup = resolve));
          cleanupStarted = new Promise<void>(started => {
            workflows.deleteWorkflowRunById = async args => {
              if (args.workflowName !== AGENTIC_LOOP_WORKFLOW_ID) return deleteRun(args);
              // Only the aborted segment's loop-snapshot cleanup waits; later deletions run normally.
              workflows.deleteWorkflowRunById = deleteRun;
              started();
              // A failed delete leaves the suspended snapshot in storage; the fence must stay closed.
              if (resumeAfter.endsWith('snapshot cleanup failed')) {
                throw new Error('snapshot store unavailable');
              }
              await gate;
              return deleteRun(args);
            };
          });
        }
        let runId: string;
        let aborted: boolean | undefined;
        if (start !== 'generate') {
          const output = await agent.stream('Look up alpha', {
            requireToolApproval: true,
            ...(onThread ? { memory: { thread: 'abort-thread', resource: 'abort-resource' } } : {}),
          });
          let approvalSeen = false;
          for await (const chunk of output.fullStream) {
            if (chunk.type !== 'tool-call-approval') continue;
            approvalSeen = true;
            expect(executed).toEqual([]);
            if (resumeAfter === 'abort' || resumeAfter === 'abort during snapshot load with snapshot cleanup pending')
              break;
            // Keep reading until the aborted segment closes, so its cleanup has run before the user responds.
            aborted = agent.abortRunStream(output.runId);
            // Durable/evented streams stay open after aborting an approval-suspended run.
            if (engine !== 'normal' && engine !== 'fs') break;
          }
          expect(approvalSeen).toBe(true);
          runId = output.runId;
        } else {
          const output = await agent.generate('Look up alpha', { requireToolApproval: true });
          runId = output.runId;
        }
        expect(executed).toEqual([]);
        if (resumeAfter === 'abort') {
          aborted = agent.abortRunStream(runId);
        } else if (cleanupStarted && resumeAfter !== 'abort during snapshot load with snapshot cleanup pending') {
          // Bounded so a run that never starts snapshot cleanup fails by assertion, not by test timeout.
          let timer: ReturnType<typeof setTimeout> | undefined;
          const cleanup = await Promise.race([
            cleanupStarted.then(() => 'started'),
            new Promise<string>(resolve => (timer = setTimeout(resolve, 2_000, 'never started'))),
          ]);
          clearTimeout(timer);
          expect(cleanup).toBe('started');
          // Let a failed cleanup settle before the user responds.
          if (resumeAfter.endsWith('snapshot cleanup failed')) {
            await new Promise<void>(resolve => setImmediate(resolve));
          }
        } else {
          await new Promise<void>(resolve => setImmediate(resolve));
        }
        if (resumeAfter !== 'abort during snapshot load with snapshot cleanup pending') expect(aborted).toBe(true);

        const options = { runId, toolCallId: 'call_abort' };
        // Consume an incorrectly accepted resume too, so the regression proves the
        // side effect, not just whether the API happened to return a stream.
        const respond = async () => {
          if (method === 'resumeGenerate') {
            await agent.resumeGenerate({ approved: true }, options);
          } else {
            const resumed =
              method === 'resumeStream'
                ? await agent.resumeStream({ approved: true }, options)
                : await agent[method](options);
            for await (const _chunk of resumed.fullStream) {
              // Drain the resumed execution.
            }
          }
        };
        let rejection: unknown;
        try {
          if (resumeAfter === 'abort during snapshot load with snapshot cleanup pending') {
            // The user responds first; the abort lands while the resume is reading the suspended snapshot.
            const workflows = (await mastra.getStorage()!.getStore('workflows'))!;
            const loadSnapshot = workflows.loadWorkflowSnapshot.bind(workflows);
            let releaseLoad = () => {};
            const loadGate = new Promise<void>(resolve => (releaseLoad = resolve));
            const loadStarted = new Promise<void>(started => {
              workflows.loadWorkflowSnapshot = async args => {
                if (args.workflowName !== AGENTIC_LOOP_WORKFLOW_ID) return loadSnapshot(args);
                workflows.loadWorkflowSnapshot = loadSnapshot;
                started();
                await loadGate;
                return loadSnapshot(args);
              };
            });
            const response = respond();
            response.catch(() => {});
            let timer: ReturnType<typeof setTimeout> | undefined;
            const load = await Promise.race([
              loadStarted.then(() => 'started'),
              new Promise<string>(resolve => (timer = setTimeout(resolve, 2_000, 'never started'))),
            ]);
            clearTimeout(timer);
            expect(load).toBe('started');
            aborted = agent.abortRunStream(runId);
            // The resume reads the snapshot while the abort's snapshot deletion is still pending.
            const cleanup = await Promise.race([
              cleanupStarted!.then(() => 'started'),
              new Promise<string>(resolve => (timer = setTimeout(resolve, 2_000, 'never started'))),
            ]);
            clearTimeout(timer);
            expect(cleanup).toBe('started');
            releaseLoad();
            await response;
          } else {
            await respond();
          }
        } catch (error) {
          rejection = error;
        } finally {
          releaseCleanup();
        }
        expect(aborted).toBe(true);
        expect(executed).toEqual([]);
        expect(llm.getRequests().map(request => request.body.messages)).toHaveLength(1);
        expect(rejection).toMatchObject({
          id: expect.stringMatching(
            resumeAfter === 'stream completion'
              ? /^AGENT_RESUME_(ABORTED_RUN|NO_SNAPSHOT_FOUND)$/
              : /^AGENT_RESUME_ABORTED_RUN$/,
          ),
        });
      },
    );
  }
});
