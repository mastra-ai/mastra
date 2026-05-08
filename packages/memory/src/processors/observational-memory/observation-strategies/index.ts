export { ObservationStrategy } from './base';
export type { StrategyDeps } from './base';
export type { ObservationRunOpts, ObserverOutput, ProcessedObservation } from './types';

// Re-export concrete classes for direct access if needed
export { SyncObservationStrategy } from './sync';
export { AsyncBufferObservationStrategy } from './async-buffer';
export { ResourceScopedObservationStrategy } from './resource-scoped';

// Wire up the static factory on the base class
import type { ObservationalMemory } from '../observational-memory';
import { AsyncBufferObservationStrategy } from './async-buffer';
import { ObservationStrategy } from './base';
import type { StrategyDeps } from './base';
import { ResourceScopedObservationStrategy } from './resource-scoped';
import { SyncObservationStrategy } from './sync';
import type { ObservationRunOpts } from './types';

ObservationStrategy.create = ((om: ObservationalMemory, opts: ObservationRunOpts): ObservationStrategy => {
  const deps: StrategyDeps = {
    storage: om.getStorage(),
    messageHistory: om.getMessageHistory(),
    tokenCounter: om.getTokenCounter(),
    observationConfig: om.getObservationConfig(),
    reflectionConfig: om.getReflectionConfig(),
    scope: om.scope,
    retrieval: om.retrieval,
    observer: om.observer,
    reflector: om.reflector,
    observedMessageIds: om.observedMessageIds,
    obscureThreadIds: om.getObscureThreadIds(),
    onIndexObservations: om.onIndexObservations,
    emitDebugEvent: e => om.emitDebugEvent(e),
  };

  if (opts.cycleId) return new AsyncBufferObservationStrategy(deps, opts);
  if (deps.scope === 'resource' && opts.resourceId) return new ResourceScopedObservationStrategy(deps, opts);
  return new SyncObservationStrategy(deps, opts);
}) as (om: unknown, opts: ObservationRunOpts) => ObservationStrategy;
