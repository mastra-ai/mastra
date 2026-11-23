import { EventEmitterPubSub } from '../../../events/event-emitter';
import { defineResumedRunReleaseSuite } from './resumed-run-subscription-release.suite';

defineResumedRunReleaseSuite('EventEmitterPubSub', {
  createPubSub: () => new EventEmitterPubSub(),
});
