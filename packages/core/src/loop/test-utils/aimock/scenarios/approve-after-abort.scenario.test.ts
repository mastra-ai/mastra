import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { AGENTIC_LOOP_WORKFLOW_ID } from '../../../loop-builder';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

describeForAllEngines('A stopped approval cannot restart a run (#27617)', engine => {
  const getMock = useLoopScenarioAimock();

  for (const [start, resumeAfter] of [
    ['stream', 'abort'],
    ['stream', 'stream completion'],
    ['stream', 'stream completion with snapshot cleanup pending'],
    ['generate', 'abort'],
  ] as const) {
    // Only normal/fs runs own a prepared-run cleanup that deletes the suspended snapshot.
    if (resumeAfter === 'stream completion with snapshot cleanup pending' && engine !== 'normal' && engine !== 'fs') {
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
        const { agent, mastra } = await createSharedAgent(llm, { engine, tools: { lookup_status: lookup } });
        // Hold the real store's snapshot deletion open so the user responds inside the cleanup window.
        let releaseCleanup = () => {};
        let cleanupStarted: Promise<void> | undefined;
        if (resumeAfter === 'stream completion with snapshot cleanup pending') {
          const workflows = (await mastra.getStorage()!.getStore('workflows'))!;
          const deleteRun = workflows.deleteWorkflowRunById.bind(workflows);
          const gate = new Promise<void>(resolve => (releaseCleanup = resolve));
          cleanupStarted = new Promise<void>(started => {
            workflows.deleteWorkflowRunById = async args => {
              if (args.workflowName !== AGENTIC_LOOP_WORKFLOW_ID) return deleteRun(args);
              // Only the aborted segment's loop-snapshot cleanup waits; later deletions run normally.
              workflows.deleteWorkflowRunById = deleteRun;
              started();
              await gate;
              return deleteRun(args);
            };
          });
        }
        let runId: string;
        let aborted: boolean | undefined;
        if (start === 'stream') {
          const output = await agent.stream('Look up alpha', { requireToolApproval: true });
          let approvalSeen = false;
          for await (const chunk of output.fullStream) {
            if (chunk.type !== 'tool-call-approval') continue;
            approvalSeen = true;
            expect(executed).toEqual([]);
            if (resumeAfter === 'abort') break;
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
        } else if (cleanupStarted) {
          await cleanupStarted;
        } else {
          await new Promise<void>(resolve => setImmediate(resolve));
        }
        expect(aborted).toBe(true);

        const options = { runId, toolCallId: 'call_abort' };
        // Consume an incorrectly accepted resume too, so the regression proves the
        // side effect, not just whether the API happened to return a stream.
        let rejection: unknown;
        try {
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
        } catch (error) {
          rejection = error;
        } finally {
          releaseCleanup();
        }
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
