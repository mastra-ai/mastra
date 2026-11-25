import { expect, it } from 'vitest';
import { sharedBroker } from '../../../../mastra/test-utils/shared-broker';
import { RequestContext } from '../../../../request-context';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describeForAllEngines('AIMock loop scenario: shared request context', engine => {
  const getMock = useLoopScenarioAimock();

  it('answers the next request when its context still contains a completed run', async () => {
    const pubsub = engine === 'evented' ? sharedBroker({ leases: true }).connect() : undefined;
    const shared = await createSharedAgent(getMock(), { engine, pubsub });
    const requestContext = new RequestContext();
    try {
      for (const question of ['first', 'second']) {
        getMock().clearFixtures();
        getMock().clearRequests();
        getMock().resetMatchCounts();
        const { output, requests } = await runLoopScenario({
          engine,
          llm: getMock(),
          sharedAgent: shared,
          requestContext,
          prompt: `Answer the ${question} question.`,
          fixtures: llm => {
            llm.on({ endpoint: 'chat' }, { content: `${question} answer` });
          },
        });
        expect(await output.text).toBe(`${question} answer`);
        expect(requests).toHaveLength(1);
        expect(JSON.stringify(requests[0].body.messages)).toContain(`Answer the ${question} question.`);
      }
    } finally {
      await shared.mastra.shutdown();
      await pubsub?.close();
    }
  }, 10_000);
});
