import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

// #26188: a Stop button addresses a run, even when the caller has no memory thread.
describeForAllEngines(
  'AIMock loop scenario: cancel a threadless run by id',
  engine => {
    const getMock = useLoopScenarioAimock();

    it.each([true, false])(
      'cancels a running tool by id (cooperative: %s)',
      async cooperative => {
        const llm = getMock();
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'waiting', name: 'waitForJob', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Job succeeded.' });
        let started!: () => void;
        const ready = new Promise<void>(resolve => {
          started = resolve;
        });
        let release!: () => void;
        const parked = new Promise<void>(resolve => {
          release = resolve;
        });
        let cancelled = false;
        let toolFinished = false;
        const onAbort = vi.fn();
        const waitForJob = createTool({
          id: 'waitForJob',
          description: 'Wait for a long running job.',
          inputSchema: z.object({}),
          execute: async (_, context) => {
            const signal = context!.abortSignal!;
            const aborted = new Promise<void>(resolve => {
              const cancel = () => {
                cancelled = true;
                resolve();
              };
              if (signal.aborted) cancel();
              else signal.addEventListener('abort', cancel, { once: true });
            });
            started();
            await (cooperative ? Promise.race([parked, aborted]) : parked);
            toolFinished = true;
            return { cancelled };
          },
        });
        const { agent, mastra } = await createSharedAgent(llm, { engine, tools: { waitForJob } });
        const runId = `threadless-${engine}`;
        const chunks: any[] = [];
        const stream: { fullStream: AsyncIterable<any>; cleanup?: () => void } = await agent.stream(
          'Wait for the job.',
          {
            runId,
            maxSteps: 3,
            onAbort,
          },
        );
        const drain = (async () => {
          for await (const chunk of stream.fullStream) chunks.push(chunk);
        })();
        try {
          await ready;
          expect(agent.abortRunStream(runId)).toBe(true);
          await drain;
          expect(cancelled).toBe(true);
          expect(toolFinished).toBe(cooperative);
          expect(chunks.filter(chunk => chunk.type === 'abort')).toHaveLength(1);
          if (!cooperative) {
            expect(chunks.filter(chunk => chunk.type === 'tool-result')).toHaveLength(1);
            expect(chunks.filter(chunk => chunk.type === 'tool-error')).toHaveLength(0);
          }
          expect(onAbort).toHaveBeenCalledTimes(1);
          expect(llm.getRequests()).toHaveLength(1);
          expect(
            chunks
              .filter(c => c.type === 'text-delta')
              .map(c => c.payload.text)
              .join(''),
          ).not.toContain('Job succeeded.');
        } finally {
          release();
          stream.cleanup?.();
          if (engine !== 'inngest') await mastra.shutdown({ drainTimeout: 1000 });
        }
      },
      15_000,
    );
  },
  { skip: ['fs'] },
);
