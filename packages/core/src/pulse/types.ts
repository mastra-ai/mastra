import type { PulseRecord, PulseRelationshipRecord } from '../storage/domains/pulse';

/**
 * Pulse bus event types (experimental).
 *
 * The PulseBus carries pre-shaped pulse/relationship records — unlike the
 * ObservabilityBus there is no multi-family routing: producers (the span
 * bridge, the session forwarder, future semantic emitters) construct records
 * before emitting.
 */

export type PulseBusEvent =
  | { type: 'pulse'; record: PulseRecord }
  | { type: 'relationship'; record: PulseRelationshipRecord };

/** Reported when a pulse writer drops records (retry exhaustion etc.). */
export interface PulseDropEvent {
  type: 'drop';
  signal: 'pulse';
  reason: string;
  count: number;
  timestamp: Date;
  exporterName: string;
}

/**
 * A pulse writer registered on the {@link PulseBus}. Mirrors the observability
 * exporter conventions: handler presence = support; `flush()` drains internal
 * buffers; `shutdown()` flushes and releases resources.
 */
export interface PulseBusExporter {
  name: string;
  onPulseEvent(event: PulseBusEvent): void | Promise<void>;
  onDroppedEvent?(event: PulseDropEvent): void | Promise<void>;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

/** Configuration for the pulse pipeline on a Mastra instance (experimental). */
export interface PulseConfig {
  /**
   * Explicit pulse storage to write to. Defaults to the composite store's
   * `pulse` domain (`storage.getStore('pulse')`) when omitted.
   */
  storage?: import('../storage/domains/pulse').PulseStorage;
  /** Rows buffered before a size-triggered flush. Default 200. */
  batchSize?: number;
  /** Time-triggered flush interval in ms. Default 2000. */
  flushIntervalMs?: number;
  /** Additional pulse exporters (e.g. a standalone ClickHouse HTTP writer). */
  exporters?: PulseBusExporter[];
  /**
   * Maintain a materialized flow-summary index alongside the raw tables
   * (adapter support required). Default false — flows are derived at read time.
   */
  flowIndex?: boolean;
}
