import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from './evented';
import { createStep } from './workflow';

// A user answers a step that suspended inside a nested workflow by time
// traveling to it with resumeData. Falsy values that match the resumeSchema
// used to be dropped because resume data was checked by truthiness instead of
// presence. (#29390) Flat workflows are covered by the shared time-travel
// suite in workflows/_test-utils/src/domains/time-travel.ts.

type EngineName = 'default' | 'evented';

const stepFactories: Record<EngineName, typeof createStep> = {
  default: createStep,
  evented: createEventedStep,
};

const answers = [
  { label: 'false', schema: z.boolean(), value: false },
  { label: '0', schema: z.number(), value: 0 },
  { label: "''", schema: z.string(), value: '' },
  { label: 'null', schema: z.boolean().nullable(), value: null },
  { label: 'true', schema: z.boolean(), value: true },
] as const;

let activeMastra: Mastra | undefined;

afterEach(async () => {
  await activeMastra?.stopWorkers();
  activeMastra = undefined;
});

// prep -> inner(ask)
async function startSuspendedNestedRun(engineName: EngineName, answerSchema: z.ZodType) {
  const seenResumeData: unknown[] = [];

  const prep = stepFactories[engineName]({
    id: 'prep',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    execute: async () => ({}),
  });

  const ask = stepFactories[engineName]({
    id: 'ask',
    inputSchema: z.object({}),
    outputSchema: z.object({ answer: z.unknown() }),
    resumeSchema: answerSchema,
    execute: async ({ resumeData, suspend }) => {
      seenResumeData.push(resumeData);
      if (resumeData === undefined) {
        return suspend({ reason: 'answer required' });
      }
      return { answer: resumeData };
    },
  });

  const innerId = `nested-time-travel-inner-${engineName}`;
  const workflowParams = (id: string) => ({
    id,
    inputSchema: z.object({}),
    outputSchema: z.object({ answer: z.unknown() }),
  });
  const workflow =
    engineName === 'evented'
      ? createEventedWorkflow(workflowParams(`nested-time-travel-${engineName}`))
          .then(prep)
          .then(createEventedWorkflow(workflowParams(innerId)).then(ask).commit())
          .commit()
      : createWorkflow(workflowParams(`nested-time-travel-${engineName}`))
          .then(prep)
          .then(createWorkflow(workflowParams(innerId)).then(ask).commit())
          .commit();

  const mastra = new Mastra({
    logger: false,
    storage: new InMemoryStore(),
    ...(engineName === 'evented' ? { pubsub: new EventEmitterPubSub() } : {}),
    workflows: { [workflow.id]: workflow },
  });
  activeMastra = mastra;
  if (engineName === 'evented') {
    await mastra.startWorkers();
  }

  const run = await mastra.getWorkflow(workflow.id).createRun();
  const started = await run.start({ inputData: {} });
  seenResumeData.length = 0;

  return { run, started, innerId, seenResumeData };
}

describe.each(['default', 'evented'] as const)(
  'timeTravel into a nested workflow on the %s engine (#29390)',
  engine => {
    // Evented engine: nested time travel does not deliver resumeData to the
    // inner suspended step for any value, truthy or falsy, with or without the
    // #29390 fix. Not yet investigated.
    const itDelivers = engine === 'evented' ? it.fails : it;

    it('suspends at the inner step before time travel', async () => {
      const { started } = await startSuspendedNestedRun(engine, z.boolean());

      expect(started.status).toBe('suspended');
    });

    describe.each(answers)('answer $label', ({ schema, value }) => {
      itDelivers('delivers the answer when time traveling to the suspended inner step', async () => {
        const { run, innerId, seenResumeData } = await startSuspendedNestedRun(engine, schema);

        const result = await run.timeTravel({ step: [innerId, 'ask'], resumeData: value });

        expect(seenResumeData).toEqual([value]);
        expect(result.status).toBe('success');
        expect(result.status === 'success' && result.result).toEqual({ answer: value });
      });
    });
  },
);
