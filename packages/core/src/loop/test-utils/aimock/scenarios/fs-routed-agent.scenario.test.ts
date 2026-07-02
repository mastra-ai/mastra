/**
 * AIMock Scenario: File-routed agent parity (direct comparison)
 *
 * The `'fs'` engine variant (see {@link EngineVariant}) already runs the entire
 * scenario battery through `assembleAgentFromFsEntry` +
 * `Mastra.__registerFsAgents`, so per-scenario file-routing coverage is free.
 *
 * This file keeps the one assertion the variant matrix cannot make on its own: a
 * **side-by-side** run of a code-registered `new Agent(...)` and a file-routed
 * agent with identical inputs, proving their loop output is byte-for-byte equal.
 * It is itself skipped for the `'fs'` variant because it already builds both.
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

// Run the direct comparison on every execution engine except `'fs'` itself
// (this file builds both a code and an fs agent, so re-running it under the fs
// variant would be redundant). `'durable'` wraps the agent and is orthogonal to
// the assembly path; normal/evented fully cover loop parity.
describeForAllEngines(
  'AIMock loop scenario: file-routed agent parity',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('produces the same loop output as an equivalent code-registered agent', async () => {
      const makeTool = () =>
        createTool({
          id: 'lookup',
          description: 'Look up a value',
          inputSchema: z.object({ key: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: async ({ key }: { key: string }) => ({ value: `value-for-${key}` }),
        });

      const instructions = 'You are a lookup assistant.';
      const prompt = 'Look up the answer.';

      const scriptFixtures = (llm: any) => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_l1', name: 'lookup', arguments: { key: 'answer' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'The value is value-for-answer.' });
      };

      // Code-registered agent.
      const codeRun = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt,
        instructions,
        tools: { lookup: makeTool() },
        stopWhen: stepCountIs(5),
        fixtures: scriptFixtures,
      });
      const codeRequestCount = codeRun.requests.length;
      const codeText = await codeRun.output.text;
      const codeResults = await codeRun.output.toolResults;

      // One AIMock server is shared per suite; reset the captured journal so the
      // second run's request count is measured independently of the first.
      getMock().clearRequests();
      getMock().resetMatchCounts();

      // File-routed agent, same inputs.
      const fsRun = await runLoopScenario({
        engine,
        fsRouted: true,
        llm: getMock(),
        prompt,
        instructions,
        tools: { lookup: makeTool() },
        stopWhen: stepCountIs(5),
        fixtures: scriptFixtures,
      });
      const fsText = await fsRun.output.text;
      const fsResults = await fsRun.output.toolResults;

      expect(fsText).toBe(codeText);
      expect(fsResults.map(r => r.payload?.result)).toEqual(codeResults.map(r => r.payload?.result));

      // Same number of model turns either way.
      expect(fsRun.requests).toHaveLength(codeRequestCount);
    });
  },
  { skip: ['durable', 'fs'] },
);
