export { ObservationStrategy } from './base';
export type { ObservationRunOpts, ObserverOutput, ProcessedObservation } from './types';

// Re-export concrete classes for direct access if needed
export { SyncObservationStrategy } from './sync';
export { AsyncBufferObservationStrategy } from './async-buffer';
export { ResourceScopedObservationStrategy } from './resource-scoped';

// Wire up the static factory on the base class
import type { ObservationalMemory } from '../observational-memory';
import { AsyncBufferObservationStrategy } from './async-buffer';
import { ObservationStrategy } from './base';
import { ResourceScopedObservationStrategy } from './resource-scoped';
import { SyncObservationStrategy } from './sync';
import type { ObservationRunOpts } from './types';

ObservationStrategy.create = (om: ObservationalMemory, opts: ObservationRunOpts): ObservationStrategy => {
  if (opts.cycleId) return new AsyncBufferObservationStrategy(om, opts);
  if (om.scope === 'resource' && opts.resourceId) return new ResourceScopedObservationStrategy(om, opts);
  return new SyncObservationStrategy(om, opts);
};
