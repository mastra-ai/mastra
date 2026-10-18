/**
 * Issue #24224: with Observational Memory enabled, the step results an agent
 * hands to `prepareStep` and `stopWhen` lose their content and tool results
 * once OM observes mid-loop. The same agent without OM sees them.
 *
 * Both the agent and the observer talk to AIMock over the OpenAI API, so the
 * whole loop runs through the real model, memory and OM processor code.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

const AGENT_MODEL = 'support-agent-model';
const OBSERVER_MODEL = 'observer-model';

const OBSERVATIONS = `<observations>
## October 18, 2026
- 🔴 Customer asked to be notified about their order status
</observations>
<current-task>Notify the customer</current-task>`;

let llm: LLMock;

beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
});

afterEach(() => {
  llm.clearFixtures();
  llm.clearRequests();
  llm.resetMatchCounts();
});

afterAll(async () => {
  await llm.stop();
});

/**
 * Each agent turn notifies the customer and ends its turn: two tool calls per
 * step. OM rewrites the prompt, so turns are matched by order, not content.
 */
function scriptAgentTurns(turns: number) {
  for (let turn = 1; turn <= turns; turn++) {
    llm.on(
      { endpoint: 'chat', model: AGENT_MODEL, sequenceIndex: turn - 1 },
      {
        toolCalls: [
          { id: `send-${turn}`, name: 'sendMessage', arguments: JSON.stringify({ message: `update ${turn}` }) },
          { id: `end-${turn}`, name: 'endTurn', arguments: '{}' },
        ],
      },
    );
  }
  llm.on({ endpoint: 'chat', model: OBSERVER_MODEL }, { content: OBSERVATIONS });
}

function createSupportAgent(withObservationalMemory: boolean) {
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });

  const memory = new Memory({
    storage: new InMemoryStore(),
    options: withObservationalMemory
      ? {
          observationalMemory: {
            enabled: true,
            observation: { model: openai(OBSERVER_MODEL), messageTokens: 20, bufferTokens: false },
            reflection: { model: openai(OBSERVER_MODEL), observationTokens: 50_000 },
          },
        }
      : {},
  });

  return new Agent({
    id: 'support-agent',
    name: 'Support agent',
    instructions: 'Notify the customer, then end your turn.',
    model: openai(AGENT_MODEL),
    memory,
    tools: {
      sendMessage: createTool({
        id: 'sendMessage',
        description: 'Send the customer a message',
        inputSchema: z.object({ message: z.string() }),
        execute: async ({ message }) => ({ delivered: message }),
      }),
      endTurn: createTool({
        id: 'endTurn',
        description: 'End the turn',
        inputSchema: z.object({}),
        execute: async () => ({ ended: true }),
      }),
    },
  });
}

type SeenStep = { toolResultIds: string[] };

function describeStep(step: any): SeenStep {
  return {
    toolResultIds: (step.toolResults ?? []).map((r: any) => r.payload?.toolCallId ?? r.toolCallId),
  };
}

async function runThreeSteps(withObservationalMemory: boolean) {
  scriptAgentTurns(3);
  const agent = createSupportAgent(withObservationalMemory);

  const prepareStepSaw: SeenStep[][] = [];
  const stopWhenSaw: SeenStep[] = [];

  const output = await agent.stream('Let me know when my order ships.', {
    memory: { thread: `thread-${withObservationalMemory}`, resource: 'customer-1' },
    prepareStep: ({ steps }) => {
      prepareStepSaw.push(steps.map(describeStep));
      return undefined;
    },
    stopWhen: ({ steps }) => {
      stopWhenSaw.push(describeStep(steps[steps.length - 1]));
      return steps.length >= 3;
    },
  });
  await output.consumeStream();
  const finalSteps = (await output.steps).map(describeStep);

  return { prepareStepSaw, stopWhenSaw, finalSteps };
}

const EXPECTED_STEPS: SeenStep[] = [1, 2, 3].map(turn => ({
  toolResultIds: [`send-${turn}`, `end-${turn}`],
}));

describe('step results with Observational Memory (#24224)', () => {
  it('without OM, prepareStep and stopWhen see each previous step’s tool results', async () => {
    const { prepareStepSaw, stopWhenSaw, finalSteps } = await runThreeSteps(false);
    expect(prepareStepSaw).toEqual([[], EXPECTED_STEPS.slice(0, 1), EXPECTED_STEPS.slice(0, 2)]);
    expect(stopWhenSaw).toEqual(EXPECTED_STEPS);
    expect(finalSteps).toEqual(EXPECTED_STEPS);
  });

  it('with OM observing mid-loop, prepareStep and stopWhen still see each previous step’s tool results', async () => {
    const { prepareStepSaw, stopWhenSaw, finalSteps } = await runThreeSteps(true);
    const observerCalls = llm.getRequests().filter(r => r.body?.model === OBSERVER_MODEL);
    expect(observerCalls.length, 'OM must observe during the loop for this scenario to mean anything').toBeGreaterThan(
      0,
    );

    expect(prepareStepSaw, 'prepareStep lost previous-step tool results under OM').toEqual([
      [],
      EXPECTED_STEPS.slice(0, 1),
      EXPECTED_STEPS.slice(0, 2),
    ]);
    expect(stopWhenSaw, 'stopWhen saw an empty last step under OM').toEqual(EXPECTED_STEPS);
    expect(finalSteps).toEqual(EXPECTED_STEPS);
  });
});
