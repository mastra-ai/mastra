import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

const hosts: Mastra[] = [];

afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.stopWorkers()));
});

// A run that stops after a loop iteration ends, before the next one starts, is restarted on another host.
describe.each([1, 2] as const)('evented loop restart between iterations (storage v%s)', storageVersion => {
  const restartLoop = async () => {
    const storage = new MockStore();
    const id = `loop-restart-v${storageVersion}`;
    const runId = `${id}-run`;
    const inputs: unknown[] = [];
    const build = () =>
      createWorkflow({
        id,
        inputSchema: z.object({ n: z.number() }),
        outputSchema: z.object({ n: z.number() }),
        options: { storageVersion },
      })
        .dountil(
          createStep({
            id: 'body',
            inputSchema: z.object({ n: z.number() }),
            outputSchema: z.object({ n: z.number() }),
            execute: async ({ inputData }) => {
              inputs.push(inputData);
              return { n: inputData.n + 1 };
            },
          }),
          async ({ inputData }) => inputData.n >= 3,
        )
        .commit();

    // The first host stops delivering events when the loop starts its second iteration.
    const pubsub = new EventEmitterPubSub();
    const publish = pubsub.publish.bind(pubsub);
    let bodyRuns = 0;
    const stopped = Promise.withResolvers<void>();
    pubsub.publish = async (topic, event) => {
      if (topic === 'workflows' && event.type === 'workflow.step.run' && ++bodyRuns === 2) {
        stopped.resolve();
        return;
      }
      return publish(topic, event);
    };
    const first = build();
    const crashed = new Mastra({ logger: false, storage, workflows: { [id]: first }, pubsub });
    await crashed.startWorkers();
    hosts.push(crashed);
    void (await first.createRun({ runId })).start({ inputData: { n: 0 } }).catch(() => {});
    await stopped.promise;
    await new Promise(resolve => setTimeout(resolve, 20));

    const second = build();
    const host = new Mastra({ logger: false, storage, workflows: { [id]: second }, pubsub: new EventEmitterPubSub() });
    await host.startWorkers();
    hosts.push(host);
    inputs.length = 0;
    const result: any = await (await second.createRun({ runId })).restart();
    return { result, inputs };
  };

  it('finishes the loop with the right result', async () => {
    const { result } = await restartLoop();

    expect(result.status).toBe('success');
    expect(result.result).toEqual({ n: 3 });
  });

  // v1 has no record that the next iteration was started, so the restart re-runs the finished
  // one (the result is still right). That predates storage v2.
  (storageVersion === 1 ? it.fails : it)('does not re-run the finished iteration', async () => {
    const { inputs } = await restartLoop();

    expect(inputs[0]).toEqual({ n: 1 });
  });
});
