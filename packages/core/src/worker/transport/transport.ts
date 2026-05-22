import type { Event } from '../../events/types';

export interface EventRouter {
  route(event: Event, ack?: () => Promise<void>, nack?: () => Promise<void>): Promise<void>;
}

export interface WorkerTransport {
  start(router: EventRouter): Promise<void>;
  stop(): Promise<void>;
}
