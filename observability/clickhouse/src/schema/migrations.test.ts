import type { ClickHouseClient } from '@clickhouse/client';

import { describe, it, expect } from 'vitest';

import { ALL_MATERIALIZED_VIEWS_SQL } from './materialized-views.js';
import { runMigrations, checkSchemaStatus, dropAllTables } from './migrations.js';
import { ALL_TABLES_SQL } from './tables.js';

// Mock ClickHouse client
function createMockClickHouseClient(existingTables: string[] = []) {
  const commands: string[] = [];
  const tables = new Set(existingTables);

  return {
    commands,
    tables,
    async command(options: { query: string }) {
      commands.push(options.query);

      // Handle CREATE TABLE IF NOT EXISTS
      const createMatch = options.query.match(/CREATE\s+(?:TABLE|MATERIALIZED\s+VIEW)\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
      if (createMatch?.[1]) {
        tables.add(createMatch[1]);
      }

      // Handle DROP TABLE IF EXISTS
      const dropMatch = options.query.match(/DROP\s+TABLE\s+IF\s+EXISTS\s+(\w+)/i);
      if (dropMatch?.[1]) {
        tables.delete(dropMatch[1]);
      }
    },
    async query(options: { query: string; format?: string }) {
      // Return existing tables for schema check
      if (options.query.includes('system.tables')) {
        return {
          async json() {
            return Array.from(tables).map(name => ({ name }));
          },
        };
      }
      return {
        async json() {
          return [];
        },
      };
    },
  };
}

describe('runMigrations', () => {
  it('should create all tables and views', async () => {
    const client = createMockClickHouseClient();

    await runMigrations(client as unknown as ClickHouseClient);

    // Should have run commands for all tables and views
    const expectedCount = ALL_TABLES_SQL.length + ALL_MATERIALIZED_VIEWS_SQL.length;
    expect(client.commands.length).toBe(expectedCount);

    // Verify all tables were created
    expect(client.tables.has('mastra_admin_traces')).toBe(true);
    expect(client.tables.has('mastra_admin_spans')).toBe(true);
    expect(client.tables.has('mastra_admin_logs')).toBe(true);
    expect(client.tables.has('mastra_admin_metrics')).toBe(true);
    expect(client.tables.has('mastra_admin_scores')).toBe(true);

    // Verify all views were created
    expect(client.tables.has('mastra_admin_traces_hourly_stats')).toBe(true);
    expect(client.tables.has('mastra_admin_spans_hourly_stats')).toBe(true);
    expect(client.tables.has('mastra_admin_logs_hourly_stats')).toBe(true);
    expect(client.tables.has('mastra_admin_metrics_hourly_stats')).toBe(true);
    expect(client.tables.has('mastra_admin_scores_hourly_stats')).toBe(true);
  });

  it('should be safe to run multiple times (idempotent)', async () => {
    const client = createMockClickHouseClient();

    // Run migrations twice
    await runMigrations(client as unknown as ClickHouseClient);
    const firstRunCount = client.commands.length;

    await runMigrations(client as unknown as ClickHouseClient);
    const secondRunCount = client.commands.length;

    // Both runs should execute the same number of commands
    expect(secondRunCount).toBe(firstRunCount * 2);

    // But we should still only have the expected tables
    expect(client.tables.size).toBe(10);
  });

  it('should create tables in correct order (tables before views)', async () => {
    const client = createMockClickHouseClient();

    await runMigrations(client as unknown as ClickHouseClient);

    // Find indices of table and view creation commands
    const tracesTableIdx = client.commands.findIndex(c => c.includes('CREATE TABLE') && c.includes('mastra_admin_traces'));
    const tracesViewIdx = client.commands.findIndex(c => c.includes('CREATE MATERIALIZED VIEW') && c.includes('mastra_admin_traces_hourly_stats'));

    // Tables should be created before views
    expect(tracesTableIdx).toBeLessThan(tracesViewIdx);
  });
});

describe('checkSchemaStatus', () => {
  it('should return not initialized when no tables exist', async () => {
    const client = createMockClickHouseClient([]);

    const status = await checkSchemaStatus(client as unknown as ClickHouseClient);

    expect(status.isInitialized).toBe(false);
    expect(status.missingTables).toContain('mastra_admin_traces');
    expect(status.missingTables).toContain('mastra_admin_spans');
    expect(status.missingTables).toContain('mastra_admin_logs');
    expect(status.missingTables).toContain('mastra_admin_metrics');
    expect(status.missingTables).toContain('mastra_admin_scores');
    expect(status.missingViews).toContain('mastra_admin_traces_hourly_stats');
  });

  it('should return initialized when all tables and views exist', async () => {
    const client = createMockClickHouseClient([
      'mastra_admin_traces',
      'mastra_admin_spans',
      'mastra_admin_logs',
      'mastra_admin_metrics',
      'mastra_admin_scores',
      'mastra_admin_traces_hourly_stats',
      'mastra_admin_spans_hourly_stats',
      'mastra_admin_logs_hourly_stats',
      'mastra_admin_metrics_hourly_stats',
      'mastra_admin_scores_hourly_stats',
    ]);

    const status = await checkSchemaStatus(client as unknown as ClickHouseClient);

    expect(status.isInitialized).toBe(true);
    expect(status.missingTables).toHaveLength(0);
    expect(status.missingViews).toHaveLength(0);
  });

  it('should return not initialized when some tables are missing', async () => {
    const client = createMockClickHouseClient([
      'mastra_admin_traces',
      'mastra_admin_spans',
      // missing logs, metrics, scores
    ]);

    const status = await checkSchemaStatus(client as unknown as ClickHouseClient);

    expect(status.isInitialized).toBe(false);
    expect(status.missingTables).toContain('mastra_admin_logs');
    expect(status.missingTables).toContain('mastra_admin_metrics');
    expect(status.missingTables).toContain('mastra_admin_scores');
  });

  it('should return not initialized when some views are missing', async () => {
    const client = createMockClickHouseClient([
      'mastra_admin_traces',
      'mastra_admin_spans',
      'mastra_admin_logs',
      'mastra_admin_metrics',
      'mastra_admin_scores',
      'mastra_admin_traces_hourly_stats',
      // missing other views
    ]);

    const status = await checkSchemaStatus(client as unknown as ClickHouseClient);

    expect(status.isInitialized).toBe(false);
    expect(status.missingTables).toHaveLength(0);
    expect(status.missingViews).toContain('mastra_admin_spans_hourly_stats');
    expect(status.missingViews).toContain('mastra_admin_logs_hourly_stats');
  });
});

describe('dropAllTables', () => {
  it('should drop all tables and views', async () => {
    const client = createMockClickHouseClient([
      'mastra_admin_traces',
      'mastra_admin_spans',
      'mastra_admin_logs',
      'mastra_admin_metrics',
      'mastra_admin_scores',
      'mastra_admin_traces_hourly_stats',
      'mastra_admin_spans_hourly_stats',
      'mastra_admin_logs_hourly_stats',
      'mastra_admin_metrics_hourly_stats',
      'mastra_admin_scores_hourly_stats',
    ]);

    await dropAllTables(client as unknown as ClickHouseClient);

    // All tables should be dropped
    expect(client.tables.size).toBe(0);
    expect(client.commands.length).toBe(10);
  });

  it('should drop views before tables', async () => {
    const client = createMockClickHouseClient([
      'mastra_admin_traces',
      'mastra_admin_traces_hourly_stats',
    ]);

    await dropAllTables(client as unknown as ClickHouseClient);

    // Find indices of drop commands
    const dropViewIdx = client.commands.findIndex(c => c.includes('mastra_admin_traces_hourly_stats'));
    const dropTableIdx = client.commands.findIndex(c => c.includes('DROP TABLE') && c.includes('mastra_admin_traces') && !c.includes('hourly'));

    // Views should be dropped before tables
    expect(dropViewIdx).toBeLessThan(dropTableIdx);
  });

  it('should be safe to run when tables do not exist', async () => {
    const client = createMockClickHouseClient([]);

    // Should not throw
    await dropAllTables(client as unknown as ClickHouseClient);

    expect(client.commands.length).toBe(10); // Still executes DROP IF EXISTS
  });
});
