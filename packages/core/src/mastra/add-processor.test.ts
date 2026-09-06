import { describe, expect, it } from 'vitest';

import { Mastra } from './index';

function makeProcessor(id: string) {
  let registered: Mastra | undefined;
  return {
    processor: {
      id,
      __registerMastra(mastra: Mastra) {
        registered = mastra;
      },
    } as any,
    getRegistered: () => registered,
  };
}

describe('Mastra#addProcessor', () => {
  // Regression: a processor whose id collides with an already-registered one
  // (e.g. the state processor a signal provider bundles on a second agent) was
  // dropped before being handed the Mastra instance, so it ran for the rest of
  // the process without ever resolving storage.
  it('hands the Mastra instance to a processor even when its key is taken', () => {
    const mastra = new Mastra({ logger: false });
    const first = makeProcessor('shared-id');
    const second = makeProcessor('shared-id');

    mastra.addProcessor(first.processor);
    mastra.addProcessor(second.processor);

    expect(first.getRegistered()).toBe(mastra);
    expect(second.getRegistered()).toBe(mastra);
  });

  it('keeps the first processor registered under a key', () => {
    const mastra = new Mastra({ logger: false });
    const first = makeProcessor('shared-id');
    const second = makeProcessor('shared-id');

    mastra.addProcessor(first.processor);
    mastra.addProcessor(second.processor);

    expect(mastra.getProcessor('shared-id')).toBe(first.processor);
  });
});
