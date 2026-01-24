/**
 * Schema migration utilities for ClickHouse.
 */

import type { ClickHouseClient } from '@clickhouse/client';

import { ALL_MATERIALIZED_VIEWS_SQL } from './materialized-views.js';
import { ALL_TABLES_SQL } from './tables.js';

/**
 * Run all migrations to set up the schema.
 * Safe to call multiple times - uses CREATE IF NOT EXISTS.
 */
export async function runMigrations(client: ClickHouseClient): Promise<void> {
  // Create tables
  for (const sql of ALL_TABLES_SQL) {
    await client.command({ query: sql });
  }

  // Create materialized views
  for (const sql of ALL_MATERIALIZED_VIEWS_SQL) {
    await client.command({ query: sql });
  }
}

/**
 * Check if the schema is up to date.
 * Returns true if all tables and views exist.
 */
export async function checkSchemaStatus(client: ClickHouseClient): Promise<{
  isInitialized: boolean;
  missingTables: string[];
  missingViews: string[];
}> {
  const expectedTables = [
    'mastra_admin_traces',
    'mastra_admin_spans',
    'mastra_admin_logs',
    'mastra_admin_metrics',
    'mastra_admin_scores',
  ];

  const expectedViews = [
    'mastra_admin_traces_hourly_stats',
    'mastra_admin_spans_hourly_stats',
    'mastra_admin_logs_hourly_stats',
    'mastra_admin_metrics_hourly_stats',
    'mastra_admin_scores_hourly_stats',
  ];

  // Query existing tables
  const tablesResult = await client.query({
    query: `SELECT name FROM system.tables WHERE database = currentDatabase() AND name LIKE 'mastra_admin_%'`,
    format: 'JSONEachRow',
  });
  const existingTables = new Set((await tablesResult.json<{ name: string }>()).map(r => r.name));

  const missingTables = expectedTables.filter(t => !existingTables.has(t));
  const missingViews = expectedViews.filter(v => !existingTables.has(v));

  return {
    isInitialized: missingTables.length === 0 && missingViews.length === 0,
    missingTables,
    missingViews,
  };
}

/**
 * Drop all tables and views (for testing/reset).
 * WARNING: This deletes all data!
 */
export async function dropAllTables(client: ClickHouseClient): Promise<void> {
  const tables = [
    'mastra_admin_traces_hourly_stats',
    'mastra_admin_spans_hourly_stats',
    'mastra_admin_logs_hourly_stats',
    'mastra_admin_metrics_hourly_stats',
    'mastra_admin_scores_hourly_stats',
    'mastra_admin_traces',
    'mastra_admin_spans',
    'mastra_admin_logs',
    'mastra_admin_metrics',
    'mastra_admin_scores',
  ];

  for (const table of tables) {
    await client.command({ query: `DROP TABLE IF EXISTS ${table}` });
  }
}
