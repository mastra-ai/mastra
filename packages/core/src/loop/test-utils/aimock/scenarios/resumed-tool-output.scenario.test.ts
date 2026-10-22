import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { createRecordingModel, textOnlyTape, toolCallTape } from '../parity';

// #26364: a resumed result must retain calls from before the suspension,
// including completed earlier steps, without replaying them on the live stream.
describeForAllEngines(
  'AIMock loop scenario: resumed output keeps earlier tool calls',
  engine => {
    const getMock = useLoopScenarioAimock();
    // #27926: Inngest returns no toolCalls after approval, despite executing both tools.
    // Reproduced on three real-host runs; root cause not yet established.
    const resumeTest = engine === 'inngest' ? it.fails : it;
    resumeTest('returns the completed lookup and approved purchase exactly once', async () => {
      const { model, requests } = createRecordingModel({
        tapes: [
          toolCallTape('lookup', {}, 'lookup-1'),
          toolCallTape('purchase', {}, 'purchase-1'),
          textOnlyTape('Purchased item A.'),
        ],
      });
      const executed: string[] = [];
      const lookup = createTool({
        id: 'lookup',
        description: 'Find an item.',
        inputSchema: z.object({}),
        execute: async () => {
          executed.push('lookup');
          return { item: 'A' };
        },
      });
      const purchase = createTool({
        id: 'purchase',
        description: 'Purchase an item.',
        inputSchema: z.object({}),
        requireApproval: true,
        execute: async () => {
          executed.push('purchase');
          return { purchased: 'A' };
        },
      });
      const shared = await createSharedAgent(getMock(), { engine, model, tools: { lookup, purchase } });
      let resumed: any;
      try {
        const { output } = await runLoopScenario({
          engine,
          llm: getMock(),
          sharedAgent: shared,
          prompt: 'Find and buy item A.',
          maxSteps: 4,
          fixtures: () => {},
        });
        resumed = await shared.agent.approveToolCall({ runId: output.runId, toolCallId: 'purchase-1' });
        const live: any[] = [];
        for await (const chunk of resumed.fullStream) live.push(chunk);
        expect(await resumed.text).toBe('Purchased item A.');
        expect(executed).toEqual(['lookup', 'purchase']);
        expect((await resumed.toolCalls).map((call: any) => call.payload.toolCallId)).toEqual([
          'lookup-1',
          'purchase-1',
        ]);
        expect(live.filter(c => c.type === 'tool-call')).toHaveLength(0);
        expect(live.filter(c => c.type === 'tool-result').map(c => c.payload.toolCallId)).toEqual(['purchase-1']);
        expect(requests).toHaveLength(3);
        const results = requests[2]!.prompt.filter(m => m.role === 'tool').flatMap(m => m.content);
        expect(results.map((r: any) => r.toolCallId)).toEqual(['lookup-1', 'purchase-1']);
      } finally {
        resumed?.cleanup?.();
        if (engine !== 'inngest') await shared.mastra.shutdown({ drainTimeout: 1000 });
      }
    });
  },
  { skip: ['fs'] },
);
