import type { Event } from '../../events/types';

export interface EventRouter {
  route(event: Event, ack?: () => Promise<void>, nack?: () => Promise<void>): Promise<void>;
}

export interface WorkerTransportStopOptions {
  /** Max time to wait for in-flight event handling before giving up, in ms. */
  drainTimeout?: number;
}

export interface WorkerTransport {
  start(router: EventRouter): Promise<void>;
  stop(options?: WorkerTransportStopOptions): Promise<void>;
}
