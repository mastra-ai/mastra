import type { PubSub } from './pubsub';

/**
 * Whether events published on `pubsub` can reach a subscriber in another
 * process, read from the transport under any decorator.
 *
 * Only an explicit `false` counts as no. A pubsub built against a copy of
 * `@mastra/core` that predates `deliversAcrossProcesses` has no such getter, and
 * must keep being treated as a shared transport.
 */
export function reachesOtherProcesses(pubsub: PubSub): boolean {
  return pubsub.__rawBus().deliversAcrossProcesses !== false;
}
