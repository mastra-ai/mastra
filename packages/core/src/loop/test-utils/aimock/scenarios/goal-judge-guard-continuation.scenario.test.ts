import { createGoogleGenerativeAI } from '@ai-sdk/google-v5';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import type { EngineVariant } from '../types';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Story: a Gemini 3 agent in goal mode is handed a conversation that ends on an
 * assistant prefill. Gemini 3 rejects a request ending on a model turn, so
 * `TrailingAssistantGuard` appends a synthetic user turn ("Continue.", or
 * "Generate the structured response." under native structured output) to the
 * provider request. The goal judge must still see the user's real message as the
 * latest user message, not the guard's synthetic one (#25541).
 */
const getMock = useLoopScenarioAimock();

const GEMINI_MODEL_ID = 'gemini-3.5-flash-lite';
const USER_TEXT = 'Pick option B';

function providers(url: string) {
  const base = url.replace(/\/+$/, '');
  return {
    openai: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${base}/v1` }),
    google: createGoogleGenerativeAI({ apiKey: 'aimock-test-key', baseURL: `${base}/v1beta` }),
  };
}

function requestText(body: unknown): string {
  return JSON.stringify(body);
}

async function runGuardedGoalTurn(
  engine: EngineVariant,
  { threadId, reply, structuredOutput }: { threadId: string; reply: string; structuredOutput?: { schema: z.ZodType } },
) {
  const llm = getMock();
  const { openai, google } = providers(llm.url);
  const memory = new MockMemory();
  const goal = { judge: openai(SCENARIO_MODEL_ID), maxRuns: 3 };
  const model = google(GEMINI_MODEL_ID);
  const sharedAgent = await createSharedAgent(llm, { model, memory, goal, engine });
  const common = { sharedAgent, engine, llm, model, memory, threadId, resourceId: 'user-1', goal };

  // Turn 1: the user states the goal; the judge parks it waiting on the user.
  await runLoopScenario({
    ...common,
    prompt: USER_TEXT,
    objective: USER_TEXT,
    fixtures: llm => {
      llm.on({ model: GEMINI_MODEL_ID }, { content: 'Should I go with option B?' });
      llm.on(
        { model: SCENARIO_MODEL_ID },
        { content: JSON.stringify({ decision: 'waiting', reason: 'Asked the user' }) },
      );
    },
  });

  llm.clearRequests();
  llm.clearFixtures();

  // Turn 2: no new user message, only an assistant prefill. The objective snapshot
  // is already in the window, so the request would end on a model turn and the
  // guard appends its synthetic user turn.
  await runLoopScenario({
    ...common,
    prompt: [{ role: 'assistant', content: 'Working on option B' }],
    ...(structuredOutput ? { structuredOutput } : {}),
    fixtures: llm => {
      llm.on({ model: GEMINI_MODEL_ID }, { content: reply });
      llm.on({ model: SCENARIO_MODEL_ID }, { content: JSON.stringify({ decision: 'done', reason: 'Picked B' }) });
    },
  });

  const requests = llm.getRequests();
  const agentRequests = requests.filter(r => r.body?.model === GEMINI_MODEL_ID).map(r => requestText(r.body));
  const judgeRequests = requests.filter(r => r.body?.model === SCENARIO_MODEL_ID).map(r => requestText(r.body));
  return { agentRequests, judgeRequests };
}

describeForAllEngines('AIMock loop scenario: goal judge ignores TrailingAssistantGuard turns', engine => {
  it('judges against the real user message when the guard appends "Continue."', async () => {
    const { agentRequests, judgeRequests } = await runGuardedGoalTurn(engine, {
      threadId: `guard-continue-${engine}`,
      reply: 'Option B is picked.',
    });

    // The guard fired: the Gemini request ends on the synthetic user turn.
    expect(agentRequests).toHaveLength(1);
    expect(agentRequests[0]).toContain('"content":"Continue."');

    expect(judgeRequests).toHaveLength(1);
    expect(judgeRequests[0]).toContain('Latest user message:\\nPick option B');
    expect(judgeRequests[0]).not.toContain('Continue.');
  });

  it('judges against the real user message when the guard appends the structured-output turn', async () => {
    const { agentRequests, judgeRequests } = await runGuardedGoalTurn(engine, {
      threadId: `guard-structured-${engine}`,
      reply: JSON.stringify({ choice: 'B' }),
      structuredOutput: { schema: z.object({ choice: z.string() }) },
    });

    expect(agentRequests).toHaveLength(1);
    expect(agentRequests[0]).toContain('"content":"Generate the structured response."');

    expect(judgeRequests).toHaveLength(1);
    expect(judgeRequests[0]).toContain('Latest user message:\\nPick option B');
    expect(judgeRequests[0]).not.toContain('Generate the structured response.');
  });
});
