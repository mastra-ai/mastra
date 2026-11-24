import { describe, expect, it } from 'vitest';
import type { OutputProcessor } from '../../../../processors/index';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Story: a delivery bot answers, then an output guardrail rejects the answer. The app reads the
 * result from several surfaces (`text`, `steps`, `response.messages`, `getFullOutput()`). If they
 * disagree, one surface shows the customer text that another surface says was withheld. (#24443)
 *
 * - processOutputResult and processOutputStream trip after the answer was produced, so the answer
 *   is the run's text everywhere.
 * - processOutputStep trips before the step is accepted, so the answer is dropped everywhere.
 */

const ANSWER = 'We deliver on Friday. Card or bank transfer.';
const HOOKS = ['processOutputResult', 'processOutputStep', 'processOutputStream'] as const;
type Hook = (typeof HOOKS)[number];

function rejectAt(hook: Hook): OutputProcessor {
  const id = `tripwire-${hook}`;
  const reason = `rejected at ${hook}`;
  if (hook === 'processOutputStream') {
    return {
      id,
      processOutputStream: async ({ part, abort }) => {
        if (part.type === 'finish') abort(reason);
        return part;
      },
    };
  }
  if (hook === 'processOutputStep') return { id, processOutputStep: async ({ abort }) => abort(reason) };
  return { id, processOutputResult: async ({ abort }) => abort(reason) };
}

const assistantText = (messages: any[]) =>
  messages
    .filter(m => m.role === 'assistant')
    .flatMap(m => (typeof m.content === 'string' ? [m.content] : m.content))
    .map((p: any) => (typeof p === 'string' ? p : p.type === 'text' ? p.text : ''))
    .join('');

const uiAssistantText = (messages: any[]) =>
  messages
    .filter(m => m.role === 'assistant')
    .flatMap(m => m.parts ?? [])
    .map((p: any) => (p.type === 'text' ? p.text : ''))
    .join('');

describeForAllEngines('Output tripwire result surfaces agree (#24443)', engine => {
  const getMock = useLoopScenarioAimock();

  for (const hook of HOOKS) {
    // Durable and evented used to drop the answer from `response.messages` here (#27562).
    it(`stream(): text, steps, response and getFullOutput agree when ${hook} trips`, async () => {
      const { output, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Do you deliver here?',
        outputProcessors: [rejectAt(hook)],
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: ANSWER });
        },
      });

      const full = await output.getFullOutput();
      const text = await output.text;
      const steps = await output.steps;
      const response = await output.response;
      const responseText = assistantText(response?.messages ?? []);

      expect(requests).toHaveLength(1);
      expect(full.tripwire).toMatchObject({ reason: `rejected at ${hook}`, processorId: `tripwire-${hook}` });
      expect(full.text).toBe(text);
      expect(text).toBe(hook === 'processOutputStep' ? '' : ANSWER);
      if (steps.length > 0) expect(steps.map(s => s.text).join('')).toBe(text);
      if (hook === 'processOutputResult') expect(steps.length).toBeGreaterThan(0);
      // Gap-hitting assertion last: the response must carry the same text as `text`.
      if (hook === 'processOutputResult') {
        expect(responseText).toBe(ANSWER);
        expect(uiAssistantText(response?.uiMessages ?? [])).toBe(ANSWER);
      } else if (responseText) expect(responseText).toBe(text);
    });
  }
});

/** generate() runs on the plain agent only: durable wrappers expose stream() only. */
describe('Output tripwire result surfaces agree through generate() (#24443)', () => {
  const getMock = useLoopScenarioAimock();

  for (const hook of HOOKS) {
    it(`generate(): text agrees with steps and response when ${hook} trips`, async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat' }, { content: ANSWER });
      const { agent } = await createSharedAgent(llm);

      const result = await agent.generate('Do you deliver here?', { outputProcessors: [rejectAt(hook)] });

      expect(llm.getRequests()).toHaveLength(1);
      expect(result.tripwire).toMatchObject({ reason: `rejected at ${hook}`, processorId: `tripwire-${hook}` });
      if (result.steps.length > 0) expect(result.steps.map(s => s.text).join('')).toBe(result.text);
      if (hook === 'processOutputResult') {
        expect(result.steps.length).toBeGreaterThan(0);
        expect(assistantText(result.response?.messages ?? [])).toBe(ANSWER);
      }
      expect(result.text).toBe(hook === 'processOutputStep' ? '' : ANSWER);
    });
  }
});
