import type { registerApiRoute } from '@mastra/core/server';
import type { IntakeConfig } from '../config/lead-ingestion';
import type { NormalizedEvent } from '../contracts';
import type { DestinationState, OutputProvider } from './output';
import type { LeadIntake } from '../intake';
import type { LeadEventStore } from '../persistence/lead-event-store';
import type { ReviewService } from '../review/service';

export interface InputContext {
  config: IntakeConfig;
  store: LeadEventStore;
  intake: LeadIntake;
  reviews: ReviewService;
  output: OutputProvider;
}
export type InputFactory = (context: InputContext) => EventInputProvider | Promise<EventInputProvider>;

/** An adapter prepares admission, handles a command, or ignores an irrelevant delivery. */
export type InputResult = { event: NormalizedEvent; expected?: DestinationState } | { runId: string } | undefined;

/** Trusted server adapter; incoming JSON cannot select its source or transport. */
export interface EventInputProvider {
  /** Stable registry ID selected by trusted configuration. */
  readonly id: string;
  /** The single trusted source/destination binding this driver is allowed to admit. */
  readonly source: IntakeConfig['source'];
  /** JSON uses the common authenticated event endpoint; custom uses only driver-owned transport routes. */
  readonly transport: 'json' | 'custom';
  /** Driver-owned routes; signed transports acknowledge durably before external reads. */
  readonly routes?: ReturnType<typeof registerApiRoute>[];
  /** Whether this input records sales outcomes for the aggregate report. */
  readonly salesMapped?: boolean;
  /**
   * Validate and hydrate a delivery using a configured source and server receipt time.
   * Return an event and authoritative destination state, an existing run for a handled
   * command, or undefined for an irrelevant event. External failures propagate to the
   * driver's durable retry policy.
   */
  normalize(payload: unknown, source: IntakeConfig['source'], receivedAt: string): Promise<InputResult>;
  /** Drain acknowledged deliveries, completing each only after durable admission or command handling. */
  drain?(): Promise<void>;
}
