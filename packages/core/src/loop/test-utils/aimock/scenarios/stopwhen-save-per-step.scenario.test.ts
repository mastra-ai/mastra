/**
 * AIMock Scenario: stopWhen step bookkeeping after a resume with savePerStep (#25538)
 *
 * A tool suspends to ask the user something and the run is resumed with the
 * answer. With `savePerStep`, each step's response messages are drained to
 * storage when the step finishes. After the resume the loop starts a new
 * response message, so the drained pre-resume message drops out of the
 * response set. `stopWhen` must still receive each step with that step's own
 * tool results, otherwise predicates such as "stop after N failed tool calls"
 * miscount.
 */

import type { StopCondition } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

describeForAllEngines('AIMock loop scenario: stopWhen step bookkeeping after resume with savePerStep', engine => {
  const getMock = useLoopScenarioAimock();

  for (const savePerStep of [false, true]) {
    it(`stopWhen sees each resumed step's own tool results (savePerStep ${savePerStep})`, async () => {
      const askUser = createTool({
        id: 'ask_user',
        description: 'Ask the user a question',
        inputSchema: z.object({ question: z.string() }),
        suspendSchema: z.object({ question: z.string() }),
        resumeSchema: z.object({ answer: z.string() }),
        execute: async ({ question }, context) => {
          if (!context?.agent?.resumeData) return await context?.agent?.suspend({ question });
          return { answer: context.agent.resumeData.answer };
        },
      });
      const tick = createTool({
        id: 'tick',
        description: 'Advance a counter.',
        inputSchema: z.object({ n: z.number() }),
        execute: async ({ n }) => ({ n }),
      });

      const seen: string[][] = [];
      const stopWhen: StopCondition<any> = ({ steps }) => {
        seen.push(steps.at(-1)!.toolResults.map(result => result.toolCallId));
        return false;
      };

      const memory = new MockMemory();
      const threadId = `stopwhen-resume-${engine}-${savePerStep}`;
      const shared = await createSharedAgent(getMock(), { tools: { askUser, tick }, memory, engine });

      const { output } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'tick three times after asking me',
        memory,
        threadId,
        resourceId: 'stopwhen-user',
        savePerStep,
        stopWhen,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { toolCalls: [{ id: 'call_ask', name: 'ask_user', arguments: { question: 'Ready?' } }] },
          );
          for (const n of [1, 2, 3]) {
            llm.on(
              { endpoint: 'chat', sequenceIndex: n },
              { toolCalls: [{ id: `call_${n}`, name: 'tick', arguments: { n } }] },
            );
          }
          llm.on({ endpoint: 'chat', sequenceIndex: 4 }, { content: 'Done.' });
        },
      });

      const resumed = await shared.agent.resumeStream(
        { answer: 'yes' },
        {
          runId: output.runId,
          savePerStep,
          stopWhen,
          ...(engine === 'normal' || engine === 'fs' ? {} : { maxSteps: 10 }),
        },
      );
      for await (const _chunk of resumed.fullStream) {
        // drain
      }
      expect(await resumed.text).toBe('Done.');
      expect(seen).toEqual([['call_ask'], ['call_1'], ['call_2'], ['call_3']]);
    });
  }
});
