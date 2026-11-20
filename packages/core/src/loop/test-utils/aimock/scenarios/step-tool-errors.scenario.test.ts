import type { LLMock } from '@copilotkit/aimock';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { LLMStepResult, MastraOnFinishCallbackArgs } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: tool failures in step results (#28460).
 *
 * When a step makes several tool calls and one throws, the step result must
 * still account for every call, matching the AI SDK step contract:
 * - `toolCalls` lists every call
 * - `toolResults` holds only the successful results
 * - `content` holds every tool-call, then a tool-result per call in call order;
 *   a failed call stays a tool-result whose output is `error-text`, as on main
 *   (moving failures to tool-error parts is deferred to #28541)
 */

const MISSING = 'missing.png';

function readImageTool() {
  return createTool({
    id: 'readImage',
    description: 'Read an image from disk.',
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => {
      if (path === MISSING) throw new Error(`image not found: ${path}`);
      return `pixels of ${path}`;
    },
  });
}

type Call = { id: string; path: string };

const SHAPES: Array<{ name: string; calls: [Call, Call] }> = [
  {
    name: 'first call fails',
    calls: [
      { id: 'call_bad', path: MISSING },
      { id: 'call_ok', path: 'a.png' },
    ],
  },
  {
    name: 'last call fails',
    calls: [
      { id: 'call_ok', path: 'a.png' },
      { id: 'call_bad', path: MISSING },
    ],
  },
  {
    name: 'both calls succeed',
    calls: [
      { id: 'call_a', path: 'a.png' },
      { id: 'call_b', path: 'b.png' },
    ],
  },
];

const fails = (call: Call) => call.path === MISSING;

function expectToolStep(step: LLMStepResult | undefined, calls: Call[], label: string) {
  expect(step, `${label}: tool step`).toBeDefined();

  expect.soft(step!.toolCalls, `${label}: toolCalls`).toEqual(
    calls.map(call =>
      expect.objectContaining({
        type: 'tool-call',
        runId: expect.any(String),
        from: 'AGENT',
        payload: expect.objectContaining({ toolCallId: call.id, toolName: 'readImage', args: { path: call.path } }),
      }),
    ),
  );

  // Results arrive in completion order, which parallel engines (Inngest) do not fix.
  const toolResults = [...step!.toolResults].sort((a, b) => a.payload.toolCallId.localeCompare(b.payload.toolCallId));
  expect.soft(toolResults, `${label}: toolResults holds only successful calls`).toEqual(
    calls
      .filter(call => !fails(call))
      .map(call =>
        expect.objectContaining({
          type: 'tool-result',
          runId: expect.any(String),
          from: 'AGENT',
          payload: expect.objectContaining({
            toolCallId: call.id,
            toolName: 'readImage',
            result: `pixels of ${call.path}`,
          }),
        }),
      ),
  );

  expect.soft(step!.content, `${label}: content holds every call and its outcome`).toEqual([
    ...calls.map(call =>
      expect.objectContaining({
        type: 'tool-call',
        toolCallId: call.id,
        toolName: 'readImage',
        input: { path: call.path },
      }),
    ),
    ...calls.map(call =>
      fails(call)
        ? expect.objectContaining({
            type: 'tool-result',
            toolCallId: call.id,
            toolName: 'readImage',
            input: { path: call.path },
            output: { type: 'error-text', value: expect.stringContaining(`image not found: ${MISSING}`) },
          })
        : expect.objectContaining({
            type: 'tool-result',
            toolCallId: call.id,
            toolName: 'readImage',
            input: { path: call.path },
            output: { type: 'text', value: `pixels of ${call.path}` },
          }),
    ),
  ]);
}

describeForAllEngines('AIMock loop scenario: tool failures in step results', engine => {
  const getMock = useLoopScenarioAimock();

  for (const method of ['stream', 'generate'] as const) {
    for (const shape of SHAPES) {
      it(`${method}: ${shape.name}`, async () => {
        const fixtures = (llm: LLMock) => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: shape.calls.map(call => ({ id: call.id, name: 'readImage', arguments: { path: call.path } })),
            },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        };

        const stepResults: LLMStepResult[] = [];
        let finish: MastraOnFinishCallbackArgs | undefined;
        const onStepFinish = (step: LLMStepResult) => void stepResults.push(step);
        const onFinish = (result: MastraOnFinishCallbackArgs) => void (finish = result);

        if (method === 'generate') {
          const llm = getMock();
          fixtures(llm);
          const shared = await createSharedAgent(llm, { engine, tools: { readImage: readImageTool() } });
          try {
            const result = await shared.agent.generate('Read the images.', { maxSteps: 3, onStepFinish, onFinish });
            expect(result.text).toBe('Done.');
            await expect.poll(() => finish).toBeDefined();
          } finally {
            if (engine !== 'inngest') await shared.mastra.shutdown({ drainTimeout: 1000 });
          }
        } else {
          await runLoopScenario({
            engine,
            llm: getMock(),
            prompt: 'Read the images.',
            tools: { readImage: readImageTool() },
            maxSteps: 3,
            onStepFinish,
            onFinish,
            fixtures,
          });
          await expect.poll(() => finish).toBeDefined();
        }

        expect(stepResults).toHaveLength(2);
        expectToolStep(stepResults[0], shape.calls, 'onStepFinish');
        expect
          .soft(stepResults[1]!.content, 'onStepFinish: text step content')
          .toEqual([expect.objectContaining({ type: 'text', text: 'Done.' })]);

        expect(finish!.steps).toHaveLength(2);
        expectToolStep(finish!.steps[0], shape.calls, 'onFinish steps[0]');
      });
    }
  }
});
