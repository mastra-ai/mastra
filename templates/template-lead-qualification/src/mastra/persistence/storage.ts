import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MastraCompositeStore } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';
import { LibSQLStore } from '@mastra/libsql';
import type { RuntimeConfig } from '../config/runtime';
import { LeadEventStore } from './lead-event-store';

/** Owns the native stores and the event journal through Mastra's storage lifecycle. */
export class LeadStorage extends MastraCompositeStore {
  readonly leadEvents: LeadEventStore;
  readonly telemetryStore: DuckDBStore;
  private closing?: Promise<void>;

  private constructor(
    paths: Pick<RuntimeConfig, 'applicationPath' | 'observabilityPath'>,
    private readonly flushTelemetry: () => Promise<void>,
  ) {
    const url = pathToFileURL(paths.applicationPath).href;
    const operational = new LibSQLStore({ id: 'lead-operations', url });
    const telemetryStore = new DuckDBStore({
      id: 'lead-observability',
      path: paths.observabilityPath,
      memoryLimit: '512MB',
      threads: 2,
    });
    super({ id: 'lead-storage', default: operational, domains: { observability: telemetryStore.observability } });
    this.leadEvents = new LeadEventStore(url);
    this.telemetryStore = telemetryStore;
  }

  static async open(
    paths: Pick<RuntimeConfig, 'applicationPath' | 'observabilityPath'>,
    flushTelemetry: () => Promise<void>,
  ) {
    await mkdir(dirname(paths.applicationPath), { recursive: true });
    await mkdir(dirname(paths.observabilityPath), { recursive: true });
    const storage = new LeadStorage(paths, flushTelemetry);
    await storage.init();
    return storage;
  }

  override async init() {
    try {
      await this.leadEvents.init();
      await super.init();
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  override close(): Promise<void> {
    this.closing ??= (async () => {
      // Mastra closes storage before observability; flush while DuckDB is still open.
      try {
        await this.flushTelemetry();
      } finally {
        try {
          await super.close();
        } finally {
          this.leadEvents.close();
          await this.telemetryStore.close();
        }
      }
    })();
    return this.closing;
  }
}
