import {
  TABLE_EXPERIMENTS,
  TABLE_EXPERIMENT_RESULTS,
  TABLE_DATASETS,
  TABLE_DATASET_ITEMS,
  TABLE_DATASET_VERSIONS,
} from '@mastra/core/storage';
import type { Experiment } from '@mastra/core/storage';
import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { exportSchemas, PostgresStore } from '../../index';
import { connectionString } from '../../test-utils';

// Will import once the file exists
import { DatasetsPG } from '../datasets/index';
import { ExperimentsPG } from './index';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const TEST_SCHEMA = 'experiments_test';

describe('ExperimentsPG', () => {
  let experiments: ExperimentsPG;
  let datasets: DatasetsPG;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    datasets = new DatasetsPG({ pool, schemaName: TEST_SCHEMA });
    experiments = new ExperimentsPG({ pool, schemaName: TEST_SCHEMA });
    await datasets.init();
    await experiments.init();
  });

  afterAll(async () => {
    await experiments.dangerouslyClearAll();
    await datasets.dangerouslyClearAll();
    await pool.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await pool.end();
  });

  beforeEach(async () => {
    await experiments.dangerouslyClearAll();
    await datasets.dangerouslyClearAll();
  });

  // ---------------------------------------------------------------------------
  // T2.2 — Class structure
  // ---------------------------------------------------------------------------
  describe('T2.2 — Class structure', () => {
    it('has MANAGED_TABLES with 2 experiment tables', () => {
      expect(ExperimentsPG.MANAGED_TABLES).toContain(TABLE_EXPERIMENTS);
      expect(ExperimentsPG.MANAGED_TABLES).toContain(TABLE_EXPERIMENT_RESULTS);
      expect(ExperimentsPG.MANAGED_TABLES).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // T2.3 — DDL export
  // ---------------------------------------------------------------------------
  describe('T2.3 — DDL export', () => {
    it('getExportDDL returns SQL containing both tables', () => {
      const ddl = ExperimentsPG.getExportDDL();
      const joined = ddl.join('\n');

      expect(joined).toContain(TABLE_EXPERIMENTS);
      expect(joined).toContain(TABLE_EXPERIMENT_RESULTS);
    });
  });

  // ---------------------------------------------------------------------------
  // T2.4 — init creates tables
  // ---------------------------------------------------------------------------
  describe('T2.4 — init creates tables', () => {
    it('both experiment tables exist in PG after init', async () => {
      for (const table of [TABLE_EXPERIMENTS, TABLE_EXPERIMENT_RESULTS]) {
        const result = await pool.query(
          `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '${TEST_SCHEMA}' AND table_name = $1)`,
          [table],
        );
        expect(result.rows[0]?.exists).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // T2.5 — Default indexes
  // ---------------------------------------------------------------------------
  describe('T2.5 — Default indexes', () => {
    it('getDefaultIndexDefinitions returns 3 indexes', () => {
      const indexes = experiments.getDefaultIndexDefinitions();
      expect(indexes).toHaveLength(3);
    });

    it('all 3 indexes exist in PG after init', async () => {
      const expectedIndexes = [
        'idx_experiments_datasetid',
        'idx_experiment_results_experimentid',
        'idx_experiment_results_exp_item',
      ];

      for (const indexName of expectedIndexes) {
        const result = await pool.query(
          `SELECT 1 FROM pg_indexes WHERE indexname = $1 AND schemaname = '${TEST_SCHEMA}'`,
          [indexName],
        );
        expect(result.rowCount).toBeGreaterThan(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // T2.6 — Experiment CRUD
  // ---------------------------------------------------------------------------
  describe('T2.6 — Experiment CRUD', () => {
    it('createExperiment returns experiment with pending status and zero counts', async () => {
      const exp = await experiments.createExperiment({
        name: 'test-exp',
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 5,
      });

      expect(exp.id).toBeDefined();
      expect(exp.name).toBe('test-exp');
      expect(exp.status).toBe('pending');
      expect(exp.succeededCount).toBe(0);
      expect(exp.failedCount).toBe(0);
      expect(exp.skippedCount).toBe(0);
    });

    it('updateExperiment updates fields and returns updated record', async () => {
      const exp = await experiments.createExperiment({
        name: 'update-exp',
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 3,
      });

      const updated = await experiments.updateExperiment({
        id: exp.id,
        status: 'running',
        succeededCount: 1,
      });

      expect(updated.status).toBe('running');
      expect(updated.succeededCount).toBe(1);
      expect(updated.id).toBe(exp.id);
    });

    it('getExperimentById returns experiment or null', async () => {
      const exp = await experiments.createExperiment({
        name: 'get-exp',
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 1,
      });

      const found = await experiments.getExperimentById({ id: exp.id });
      const notFound = await experiments.getExperimentById({ id: 'nonexistent' });

      expect(found).toBeDefined();
      expect(found!.id).toBe(exp.id);
      expect(notFound).toBeNull();
    });

    it('listExperiments with pagination', async () => {
      for (let i = 0; i < 3; i++) {
        await experiments.createExperiment({
          name: `exp-${i}`,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
        });
      }

      const page0 = await experiments.listExperiments({ pagination: { page: 0, perPage: 2 } });
      expect(page0.experiments).toHaveLength(2);
      expect(page0.pagination.total).toBe(3);
      expect(page0.pagination.hasMore).toBe(true);
    });

    it('listExperiments filters by datasetId', async () => {
      const ds = await datasets.createDataset({ name: 'filter-ds' });

      await experiments.createExperiment({
        name: 'exp-with-ds',
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 1,
        datasetId: ds.id,
      });
      await experiments.createExperiment({
        name: 'exp-no-ds',
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 1,
      });

      const filtered = await experiments.listExperiments({
        datasetId: ds.id,
        pagination: { page: 0, perPage: 10 },
      });
      expect(filtered.experiments).toHaveLength(1);
      expect(filtered.experiments[0]!.name).toBe('exp-with-ds');
    });

    it('deleteExperiment removes results first then experiment', async () => {
      const exp = await experiments.createExperiment({
        name: 'delete-exp',
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 1,
      });

      await experiments.addExperimentResult({
        experimentId: exp.id,
        itemId: 'item-1',
        input: { q: 'test' },
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      await experiments.deleteExperiment({ id: exp.id });

      expect(await experiments.getExperimentById({ id: exp.id })).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // T2.7 — Experiment results
  // ---------------------------------------------------------------------------
  describe('T2.7 — Experiment results', () => {
    let exp: Experiment;

    beforeEach(async () => {
      await experiments.dangerouslyClearAll();
      await datasets.dangerouslyClearAll();
      exp = await experiments.createExperiment({
        name: 'results-exp',
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 3,
      });
    });

    it('addExperimentResult inserts a result row', async () => {
      const result = await experiments.addExperimentResult({
        experimentId: exp.id,
        itemId: 'item-1',
        input: { q: 'hello' },
        output: { a: 'world' },
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      expect(result.id).toBeDefined();
      expect(result.experimentId).toBe(exp.id);
      expect(result.input).toEqual({ q: 'hello' });
    });

    it('getExperimentResultById returns result or null', async () => {
      const result = await experiments.addExperimentResult({
        experimentId: exp.id,
        itemId: 'item-1',
        input: { q: 'test' },
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      const found = await experiments.getExperimentResultById({ id: result.id });
      const notFound = await experiments.getExperimentResultById({ id: 'nonexistent' });

      expect(found).toBeDefined();
      expect(found!.id).toBe(result.id);
      expect(notFound).toBeNull();
    });

    it('listExperimentResults paginates and orders by startedAt ASC', async () => {
      const now = new Date();
      for (let i = 0; i < 3; i++) {
        await experiments.addExperimentResult({
          experimentId: exp.id,
          itemId: `item-${i}`,
          input: { q: `q${i}` },
          startedAt: new Date(now.getTime() + i * 1000),
          completedAt: new Date(now.getTime() + i * 1000 + 500),
          retryCount: 0,
        });
      }

      const results = await experiments.listExperimentResults({
        experimentId: exp.id,
        pagination: { page: 0, perPage: 2 },
      });

      expect(results.results).toHaveLength(2);
      expect(results.pagination.total).toBe(3);
      // Ordered by startedAt ASC
      expect(new Date(results.results[0]!.startedAt).getTime()).toBeLessThanOrEqual(
        new Date(results.results[1]!.startedAt).getTime(),
      );
    });

    it('deleteExperimentResults removes all results for experimentId', async () => {
      await experiments.addExperimentResult({
        experimentId: exp.id,
        itemId: 'item-1',
        input: { q: 'a' },
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });
      await experiments.addExperimentResult({
        experimentId: exp.id,
        itemId: 'item-2',
        input: { q: 'b' },
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      await experiments.deleteExperimentResults({ experimentId: exp.id });

      const results = await experiments.listExperimentResults({
        experimentId: exp.id,
        pagination: { page: 0, perPage: 10 },
      });
      expect(results.results).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // T2.8 — dangerouslyClearAll
  // ---------------------------------------------------------------------------
  describe('T2.8 — dangerouslyClearAll', () => {
    it('truncates results then experiments', async () => {
      const exp = await experiments.createExperiment({
        name: 'clear-exp',
        targetType: 'agent',
        targetId: 'agent-1',
        totalItems: 1,
      });
      await experiments.addExperimentResult({
        experimentId: exp.id,
        itemId: 'item-1',
        input: { q: 'data' },
        startedAt: new Date(),
        completedAt: new Date(),
        retryCount: 0,
      });

      await experiments.dangerouslyClearAll();

      const list = await experiments.listExperiments({ pagination: { page: 0, perPage: 10 } });
      expect(list.experiments).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// T2.9 + T2.10 — Wire-up tests
// ---------------------------------------------------------------------------
describe('T2.9/T2.10 — PostgresStore wire-up', () => {
  it('exportSchemas includes all 5 dataset/experiment tables', () => {
    const schema = exportSchemas();

    expect(schema).toContain(TABLE_DATASETS);
    expect(schema).toContain(TABLE_DATASET_ITEMS);
    expect(schema).toContain(TABLE_DATASET_VERSIONS);
    expect(schema).toContain(TABLE_EXPERIMENTS);
    expect(schema).toContain(TABLE_EXPERIMENT_RESULTS);
  });

  it('exportSchemas includes composite PK for dataset_items', () => {
    const schema = exportSchemas();

    // Should contain PRIMARY KEY (id, datasetVersion) somewhere
    expect(schema).toContain('PRIMARY KEY');
    // The composite PK for dataset_items specifically
    const datasetItemsSection = schema.split(TABLE_DATASET_ITEMS)[1]?.split('CREATE TABLE')[0];
    expect(datasetItemsSection).toContain('"id"');
    expect(datasetItemsSection).toContain('"datasetVersion"');
  });

  it('PostgresStore.stores has datasets and experiments keys', async () => {
    const pool = new Pool({ connectionString });
    const store = new PostgresStore({
      id: 'wireup-test',
      pool,
    });

    expect(store.stores.datasets).toBeDefined();
    expect(store.stores.experiments).toBeDefined();

    await pool.end();
  });
});
