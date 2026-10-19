import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

describeForAllEngines('A stopped approval cannot restart a run (#27617)', engine => {
  const getMock = useLoopScenarioAimock();

  for (const start of ['stream', 'generate'] as const) {
    // Normal/fs generate runs are not registered for abortRunStream, which returns false.
    // Keep this separate cancellation limitation visible without expanding #27617.
    const test = start === 'generate' && (engine === 'normal' || engine === 'fs') ? it.fails : it;
    test.each(['approveToolCall', 'declineToolCall', 'resumeStream', 'resumeGenerate'] as const)(
      `%s rejects after aborting ${start} without executing the tool or requesting another model turn`,
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
        const { agent } = await createSharedAgent(llm, { engine, tools: { lookup_status: lookup } });
        let runId: string;
        if (start === 'stream') {
          const output = await agent.stream('Look up alpha', { requireToolApproval: true });
          let approvalSeen = false;
          for await (const chunk of output.fullStream) {
            if (chunk.type === 'tool-call-approval') {
              approvalSeen = true;
              break;
            }
          }
          expect(approvalSeen).toBe(true);
          runId = output.runId;
        } else {
          const output = await agent.generate('Look up alpha', { requireToolApproval: true });
          runId = output.runId;
        }
        expect(executed).toEqual([]);
        expect(agent.abortRunStream(runId)).toBe(true);

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
        }
        expect(executed).toEqual([]);
        expect(llm.getRequests().map(request => request.body.messages)).toHaveLength(1);
        expect(rejection).toMatchObject({ id: 'AGENT_RESUME_ABORTED_RUN' });
      },
    );
  }
});
