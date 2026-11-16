import { expect, it } from 'vitest';

import type { Card } from '../storage/domains/work-items/base.js';
import { intakeSample } from './intake-dry-run.js';
import { INTAKE_ORDER_SAMPLE } from './intake-routing.js';
import { boardRegistryOf } from './registry.js';

// Merging, deduping and skipping manual cards run through the dry-run route test; this pins the cap.
it('samples only the newest items', async () => {
  const cards = Array.from(
    { length: INTAKE_ORDER_SAMPLE + 5 },
    (_, n) =>
      ({
        id: `card-${n}`,
        title: `${n}`,
        metadata: {},
        createdAt: new Date(n),
        externalSource: { integrationId: 'github', type: 'issue', externalId: `k${n}` },
      }) as unknown as Card,
  );
  const sample = await intakeSample({
    factoryProjectId: 'p',
    registry: boardRegistryOf([]),
    card: async () => null,
    cards,
    notRouted: [],
  });
  expect([sample.length, sample[0]!.key]).toEqual([INTAKE_ORDER_SAMPLE, `k${INTAKE_ORDER_SAMPLE + 4}`]);
});
