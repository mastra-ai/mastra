import { createSampleThread } from '@internal/storage-test-utils';
import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import pgPromise from 'pg-promise';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PostgresStoreConfig } from '../shared/config';
import { PostgresStore } from '.';

export const TEST_CONFIG: PostgresStoreConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5434,
  database: process.env.POSTGRES_DB || 'postgres',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
};

export const connectionString = `postgresql://${TEST_CONFIG.user}:${TEST_CONFIG.password}@${TEST_CONFIG.host}:${TEST_CONFIG.port}/${TEST_CONFIG.database}`;

export function pgTests() {
  let store: PostgresStore;

  describe('PG specific tests', () => {
    beforeAll(async () => {
      store = new PostgresStore(TEST_CONFIG);
      await store.init();
    });
    afterAll(async () => {
      try {
        await store.close();
      } catch {}
    });

    describe('Public Fields Access', () => {
      it('should expose db field as public', () => {
        expect(store.db).toBeDefined();
        expect(typeof store.db).toBe('object');
        expect(store.db.query).toBeDefined();
        expect(typeof store.db.query).toBe('function');
      });

      it('should expose pgp field as public', () => {
        expect(store.pgp).toBeDefined();
        expect(typeof store.pgp).toBe('function');
        expect(store.pgp.end).toBeDefined();
        expect(typeof store.pgp.end).toBe('function');
      });

      it('should allow direct database queries via public db field', async () => {
        const result = await store.db.one('SELECT 1 as test');
        expect(result.test).toBe(1);
      });

      it('should allow access to pgp utilities via public pgp field', () => {
        const helpers = store.pgp.helpers;
        expect(helpers).toBeDefined();
        expect(helpers.insert).toBeDefined();
        expect(helpers.update).toBeDefined();
      });

      it('should maintain connection state through public db field', async () => {
        // Test multiple queries to ensure connection state
        const result1 = await store.db.one('SELECT NOW() as timestamp1');
        const result2 = await store.db.one('SELECT NOW() as timestamp2');

        expect(result1.timestamp1).toBeDefined();
        expect(result2.timestamp2).toBeDefined();
        expect(new Date(result2.timestamp2).getTime()).toBeGreaterThanOrEqual(new Date(result1.timestamp1).getTime());
      });

      it('should throw error when pool is used after disconnect', async () => {
        await store.close();
        await expect(store.db.connect()).rejects.toThrow();
        store = new PostgresStore(TEST_CONFIG);
        await store.init();
      });
    });

    describe('Large Payload Handling', () => {
      describe('Full Persist Workflow Snapshot', () => {
        // Pattern 1: Single Large String
        describe('Single Large String Payloads', () => {
          it('should store 100MB string payload successfully', async () => {
            const largeString = 'A'.repeat(100 * 1024 * 1024); // 100MB
            const snapshot = {
              runId: 'run_' + Date.now(),
              status: 'running',
              value: {},
              context: { input: {} } as any,
              result: { largeData: largeString },
              serializedStepGraph: [],
              activePaths: [],
              suspendedPaths: {},
              waitingPaths: {},
              timestamp: Date.now(),
            } as WorkflowRunState;

            const workflowName = 'large_string_success';
            const runId = snapshot.runId;

            await store.persistWorkflowSnapshot({ workflowName, runId, snapshot });

            const loadedSnapshot = await store.loadWorkflowSnapshot({ workflowName, runId });
            expect(loadedSnapshot).toBeDefined();
            expect(loadedSnapshot?.result?.largeData).toEqual(largeString);
          }, 120_000);

          it('should fail with pg-promise formatting error for 300MB string payload', async () => {
            // 300MB: Within JSON.stringify limit (~500MB) but exceeds pg-promise formatting limit (~255MB)
            const hugeString = 'A'.repeat(300 * 1024 * 1024);

            const snapshot = {
              runId: 'run_' + Date.now(),
              status: 'running',
              value: {},
              context: { input: {} } as any,
              result: { largeData: hugeString },
              serializedStepGraph: [],
              activePaths: [],
              suspendedPaths: {},
              waitingPaths: {},
              timestamp: Date.now(),
            } as WorkflowRunState;

            // Verify JSON.stringify works
            expect(() => JSON.stringify(snapshot)).not.toThrow();

            // But database insert should fail with pg-promise formatting error
            try {
              await store.persistWorkflowSnapshot({
                workflowName: 'string_insert_fail',
                runId: snapshot.runId,
                snapshot,
              });
              expect.fail('Should have thrown an error');
            } catch (error: any) {
              expect(error.message).toContain('Database query formatting failed');
              expect(error.message).toContain('pg-promise limit');
              expect(error.id).toBe('MASTRA_STORAGE_PG_STORE_PERSIST_WORKFLOW_SNAPSHOT_FAILED');
            }
          }, 120_000);

          it('should fail with JSON.stringify error for 600MB string payload', async () => {
            // 600MB: Exceeds JSON.stringify limit (~500MB)
            const massiveString1 = 'A'.repeat(200 * 1024 * 1024);
            const massiveString2 = 'B'.repeat(200 * 1024 * 1024);
            const massiveString3 = 'C'.repeat(200 * 1024 * 1024);

            const snapshot = {
              runId: 'run_' + Date.now(),
              status: 'running',
              value: {},
              context: { input: {} } as any,
              result: {
                data1: massiveString1,
                data2: massiveString2,
                data3: massiveString3,
              },
              serializedStepGraph: [],
              activePaths: [],
              suspendedPaths: {},
              waitingPaths: {},
              timestamp: Date.now(),
            } as WorkflowRunState;

            const workflowName = 'string_stringify_fail';
            const runId = snapshot.runId;

            // This should fail at JSON.stringify (exceeds ~500MB limit)
            try {
              await store.persistWorkflowSnapshot({
                workflowName,
                runId,
                snapshot,
              });
              expect.fail('Should have thrown an error');
            } catch (error: any) {
              expect(error.message).toContain('JSON.stringify failed');
              expect(error.message).toContain('V8 string limit');
              expect(error.id).toBe('MASTRA_STORAGE_JSON_STRINGIFY_FAILED');
            }
          }, 120_000);
        });

        // Pattern 2: Object Arrays
        describe('Object Array Payloads', () => {
          it('should store 100MB object array successfully', async () => {
            // Array of 25,000 objects, each ~4KB = ~100MB
            const largeArray = Array.from({ length: 25000 }, (_, i) => ({
              idx: i,
              data: 'A'.repeat(4000), // ~4KB per entry
              meta: { timestamp: Date.now(), value: Math.random() },
            }));

            const snapshot = {
              runId: 'run_' + Date.now(),
              status: 'running',
              value: {},
              context: { input: {} } as any,
              result: { dataArray: largeArray },
              serializedStepGraph: [],
              activePaths: [],
              suspendedPaths: {},
              waitingPaths: {},
              timestamp: Date.now(),
            } as WorkflowRunState;

            const workflowName = 'array_success';
            const runId = snapshot.runId;

            await store.persistWorkflowSnapshot({ workflowName, runId, snapshot });

            const loadedSnapshot = await store.loadWorkflowSnapshot({ workflowName, runId });
            expect(loadedSnapshot).toBeDefined();
            expect(loadedSnapshot?.result?.dataArray).toEqual(largeArray);
          }, 120_000);

          it('should fail with pg-promise formatting error for 300MB object array', async () => {
            // Array of 75,000 objects, each ~4KB = ~300MB
            // Within JSON.stringify limit but exceeds pg-promise formatting limit
            const hugeArray = Array.from({ length: 75000 }, (_, i) => ({
              idx: i,
              data: 'A'.repeat(4000), // ~4KB per entry
              meta: { timestamp: Date.now(), value: Math.random() },
            }));

            const snapshot = {
              runId: 'run_' + Date.now(),
              status: 'running',
              value: {},
              context: { input: {} } as any,
              result: { dataArray: hugeArray },
              serializedStepGraph: [],
              activePaths: [],
              suspendedPaths: {},
              waitingPaths: {},
              timestamp: Date.now(),
            } as WorkflowRunState;

            // Verify JSON.stringify works
            expect(() => JSON.stringify(snapshot)).not.toThrow();

            // But database insert should fail with pg-promise formatting error
            try {
              await store.persistWorkflowSnapshot({
                workflowName: 'array_insert_fail',
                runId: snapshot.runId,
                snapshot,
              });
              expect.fail('Should have thrown an error');
            } catch (error: any) {
              expect(error.message).toContain('Database query formatting failed');
              expect(error.message).toContain('pg-promise limit');
              expect(error.id).toBe('MASTRA_STORAGE_PG_STORE_PERSIST_WORKFLOW_SNAPSHOT_FAILED');
            }
          }, 120_000);

          it('should fail with JSON.stringify error for 600MB object array', async () => {
            // Array of 150,000 objects, each ~4KB = ~600MB
            // Exceeds JSON.stringify limit (~500MB)
            const massiveArray = Array.from({ length: 150000 }, (_, i) => ({
              idx: i,
              data: 'A'.repeat(4000), // ~4KB per entry
              meta: { timestamp: Date.now(), value: Math.random() },
            }));

            const snapshot = {
              runId: 'run_' + Date.now(),
              status: 'running',
              value: {},
              context: { input: {} } as any,
              result: { dataArray: massiveArray },
              serializedStepGraph: [],
              activePaths: [],
              suspendedPaths: {},
              waitingPaths: {},
              timestamp: Date.now(),
            } as WorkflowRunState;

            const workflowName = 'array_stringify_fail';
            const runId = snapshot.runId;

            try {
              await store.persistWorkflowSnapshot({
                workflowName,
                runId,
                snapshot,
              });
              expect.fail('Should have thrown an error');
            } catch (error: any) {
              expect(error.message).toContain('JSON.stringify failed');
              expect(error.message).toContain('V8 string limit');
              expect(error.id).toBe('MASTRA_STORAGE_JSON_STRINGIFY_FAILED');
            }
          }, 120_000);
        });

        // Pattern 3: Multiple Fields
        describe('Multiple Field Payloads', () => {
          it('should store 200MB across multiple fields successfully', async () => {
            const string100MB = 'A'.repeat(100 * 1024 * 1024);
            const array50MB = Array.from({ length: 12500 }, (_, i) => ({
              idx: i,
              data: 'B'.repeat(4000), // ~4KB per entry
            }));

            const snapshot = {
              runId: 'run_' + Date.now(),
              status: 'running',
              value: {},
              context: {
                input: { largeInput: array50MB },
              } as any,
              result: { largeResult: string100MB },
              runtimeContext: { someData: 'C'.repeat(50 * 1024 * 1024) }, // 50MB
              serializedStepGraph: [],
              activePaths: [],
              suspendedPaths: {},
              waitingPaths: {},
              timestamp: Date.now(),
            } as WorkflowRunState;

            const workflowName = 'multi_field_success';
            const runId = snapshot.runId;

            await store.persistWorkflowSnapshot({ workflowName, runId, snapshot });

            const loadedSnapshot = await store.loadWorkflowSnapshot({ workflowName, runId });
            expect(loadedSnapshot).toBeDefined();
            expect(loadedSnapshot?.result?.largeResult).toEqual(string100MB);
            expect(loadedSnapshot?.context?.input?.largeInput).toEqual(array50MB);
            expect(loadedSnapshot?.runtimeContext?.someData?.length).toBe(50 * 1024 * 1024);
          }, 120_000);

          it('should fail with pg-promise formatting error for 300MB across multiple fields', async () => {
            const string100MB = 'A'.repeat(100 * 1024 * 1024);
            const array100MB = Array.from({ length: 25000 }, (_, i) => ({
              idx: i,
              data: 'B'.repeat(4000), // ~4KB per entry = ~100MB total
            }));

            const snapshot = {
              runId: 'run_' + Date.now(),
              status: 'running',
              value: {},
              context: {
                input: { largeInput: array100MB },
              } as any,
              result: { largeResult: string100MB },
              runtimeContext: { someData: 'C'.repeat(100 * 1024 * 1024) }, // 100MB
              serializedStepGraph: [],
              activePaths: [],
              suspendedPaths: {},
              waitingPaths: {},
              timestamp: Date.now(),
            } as WorkflowRunState;

            // Verify JSON.stringify works
            expect(() => JSON.stringify(snapshot)).not.toThrow();

            // But database insert should fail with pg-promise formatting error
            try {
              await store.persistWorkflowSnapshot({
                workflowName: 'multi_field_insert_fail',
                runId: snapshot.runId,
                snapshot,
              });
              expect.fail('Should have thrown an error');
            } catch (error: any) {
              expect(error.message).toContain('Database query formatting failed');
              expect(error.message).toContain('pg-promise limit');
              expect(error.id).toBe('MASTRA_STORAGE_PG_STORE_PERSIST_WORKFLOW_SNAPSHOT_FAILED');
            }
          }, 120_000);

          it('should fail with JSON.stringify error for 600MB across multiple fields', async () => {
            const string200MB = 'A'.repeat(200 * 1024 * 1024);
            const array200MB = Array.from({ length: 50000 }, (_, i) => ({
              idx: i,
              data: 'B'.repeat(4000), // ~4KB per entry = ~200MB total
            }));

            const snapshot = {
              runId: 'run_' + Date.now(),
              status: 'running',
              value: {},
              context: {
                input: { largeInput: array200MB },
              } as any,
              result: { largeResult: string200MB },
              runtimeContext: { someData: 'C'.repeat(200 * 1024 * 1024) }, // 200MB
              serializedStepGraph: [],
              activePaths: [],
              suspendedPaths: {},
              waitingPaths: {},
              timestamp: Date.now(),
            } as WorkflowRunState;

            const workflowName = 'multi_field_stringify_fail';
            const runId = snapshot.runId;

            try {
              await store.persistWorkflowSnapshot({
                workflowName,
                runId,
                snapshot,
              });
              expect.fail('Should have thrown an error');
            } catch (error: any) {
              expect(error.message).toContain('JSON.stringify failed');
              expect(error.message).toContain('V8 string limit');
              expect(error.id).toBe('MASTRA_STORAGE_JSON_STRINGIFY_FAILED');
            }
          }, 120_000);
        });

        // Pattern 4: Deep Nesting
        describe('Deeply Nested Structure Payloads', () => {
          it('should store 100MB deeply nested structure successfully', async () => {
            // Create a deeply nested structure with large leaf values
            const createNestedStructure = (depth: number, leafSize: number): any => {
              if (depth === 0) {
                return 'X'.repeat(leafSize);
              }
              return {
                level: depth,
                data: createNestedStructure(depth - 1, leafSize),
                sibling: depth > 5 ? 'Y'.repeat(leafSize / 2) : null,
              };
            };

            // 10 levels deep with ~10MB at each significant level
            const nestedData = createNestedStructure(10, 10 * 1024 * 1024);

            const snapshot = {
              runId: 'run_' + Date.now(),
              status: 'running',
              value: {},
              context: { input: {} } as any,
              result: { nested: nestedData },
              serializedStepGraph: [],
              activePaths: [],
              suspendedPaths: {},
              waitingPaths: {},
              timestamp: Date.now(),
            } as WorkflowRunState;

            const workflowName = 'nested_success';
            const runId = snapshot.runId;

            await store.persistWorkflowSnapshot({ workflowName, runId, snapshot });

            const loadedSnapshot = await store.loadWorkflowSnapshot({ workflowName, runId });
            expect(loadedSnapshot).toBeDefined();
            expect(loadedSnapshot?.result?.nested).toEqual(nestedData);
          }, 120_000);

          it('should fail with pg-promise formatting error for 300MB deeply nested structure', async () => {
            // Create a deeply nested structure around 300MB
            const createMediumNestedStructure = (depth: number, leafSize: number): any => {
              if (depth === 0) {
                return 'X'.repeat(leafSize);
              }
              return {
                level: depth,
                data: createMediumNestedStructure(depth - 1, leafSize),
                sibling1: 'Y'.repeat(leafSize / 2),
                sibling2: depth > 3 ? 'Z'.repeat(leafSize / 2) : null,
              };
            };

            // This creates ~300MB nested structure
            const hugeNestedData = createMediumNestedStructure(6, 50 * 1024 * 1024);

            const snapshot = {
              runId: 'run_' + Date.now(),
              status: 'running',
              value: {},
              context: { input: {} } as any,
              result: { nested: hugeNestedData },
              serializedStepGraph: [],
              activePaths: [],
              suspendedPaths: {},
              waitingPaths: {},
              timestamp: Date.now(),
            } as WorkflowRunState;

            // Verify JSON.stringify works
            expect(() => JSON.stringify(snapshot)).not.toThrow();

            // But database insert should fail with pg-promise formatting error
            try {
              await store.persistWorkflowSnapshot({
                workflowName: 'nested_insert_fail',
                runId: snapshot.runId,
                snapshot,
              });
              expect.fail('Should have thrown an error');
            } catch (error: any) {
              expect(error.message).toContain('Database query formatting failed');
              expect(error.message).toContain('pg-promise limit');
              expect(error.id).toBe('MASTRA_STORAGE_PG_STORE_PERSIST_WORKFLOW_SNAPSHOT_FAILED');
            }
          }, 120_000);

          it('should fail with JSON.stringify error for 600MB deeply nested structure', async () => {
            // Create a deeply nested structure that exceeds limits
            const createLargeNestedStructure = (depth: number, leafSize: number): any => {
              if (depth === 0) {
                return 'X'.repeat(leafSize);
              }
              return {
                level: depth,
                data1: createLargeNestedStructure(depth - 1, leafSize),
                data2: createLargeNestedStructure(depth - 1, leafSize),
                sibling: 'Y'.repeat(leafSize),
              };
            };

            // This will create exponential growth exceeding 600MB
            const massiveNestedData = createLargeNestedStructure(5, 30 * 1024 * 1024);

            const snapshot = {
              runId: 'run_' + Date.now(),
              status: 'running',
              value: {},
              context: { input: {} } as any,
              result: { nested: massiveNestedData },
              serializedStepGraph: [],
              activePaths: [],
              suspendedPaths: {},
              waitingPaths: {},
              timestamp: Date.now(),
            } as WorkflowRunState;

            const workflowName = 'nested_stringify_fail';
            const runId = snapshot.runId;

            try {
              await store.persistWorkflowSnapshot({
                workflowName,
                runId,
                snapshot,
              });
              expect.fail('Should have thrown an error');
            } catch (error: any) {
              expect(error.message).toContain('JSON.stringify failed');
              expect(error.message).toContain('V8 string limit');
              expect(error.id).toBe('MASTRA_STORAGE_JSON_STRINGIFY_FAILED');
            }
          }, 120_000);
        });
      });

      describe('Gradual Column Accumulation', () => {
        it.only('should handle gradual accumulation of step results up to column limits', async () => {
          const workflowName = 'gradual_accumulation_test';
          const runId = 'run_' + Date.now();

          const initialSnapshot = {
            runId,
            status: 'running',
            value: {},
            context: { input: {} } as any,
            result: {},
            serializedStepGraph: [],
            activePaths: [],
            suspendedPaths: {},
            waitingPaths: {},
            timestamp: Date.now(),
          } as WorkflowRunState;

          await store.persistWorkflowSnapshot({ workflowName, runId, snapshot: initialSnapshot });

          const stepSizeMB = 50;
          const maxSteps = 30;
          let successfulSteps = 0;
          let failedAtStepMB = 0;

          for (let i = 0; i < maxSteps; i++) {
            const stepId = `step_${i}`;
            const stepData = 'X'.repeat(stepSizeMB * 1024 * 1024);

            try {
              await store.updateWorkflowResults({
                workflowName,
                runId,
                stepId,
                result: {
                  status: 'success',
                  output: { data: stepData },
                  payload: {},
                  startedAt: Date.now(),
                  endedAt: Date.now(),
                } as any,
                runtimeContext: {},
              });

              const loadedSnapshot = await store.loadWorkflowSnapshot({ workflowName, runId });
              expect(loadedSnapshot).toBeDefined();

              const contextKeys = Object.keys(loadedSnapshot?.context || {}).filter(k => k.startsWith('step_'));
              expect(contextKeys.length).toBe(i + 1);

              const stepResult = loadedSnapshot?.context[stepId];
              expect(stepResult).toBeDefined();
              expect((stepResult as any).output.data).toEqual(stepData);

              const snapshotString = JSON.stringify(loadedSnapshot);
              const actualSizeMB = Math.round(snapshotString.length / 1024 / 1024);

              successfulSteps++;
              console.log(
                `✓ Step ${i + 1}: Added ${stepSizeMB}MB | Actual snapshot size: ${actualSizeMB}MB | Steps in context: ${contextKeys.length}`,
              );
            } catch (error: any) {
              failedAtStepMB = (i + 1) * stepSizeMB;
              console.log(`✗ Failed at step ${i + 1} (${failedAtStepMB}MB total)`);
              console.log(`  Error message: ${error.message}`);
              console.log(`  Error ID: ${error.id || 'N/A'}`);
              console.log(`  Error name: ${error.name}`);
              if (error.stack) {
                const stackLines = error.stack.split('\n').slice(0, 5);
                console.log(`  Stack (first 5 lines):\n${stackLines.join('\n')}`);
              }
              if (error.cause) {
                console.log(`  Cause: ${error.cause.message || error.cause}`);
              }
              break;
            }
          }

          expect(successfulSteps).toBeGreaterThan(0);
          console.log(`Total successful steps: ${successfulSteps}`);
          console.log(`Total data accumulated: ${successfulSteps * stepSizeMB}MB`);
          if (failedAtStepMB > 0) {
            console.log(`Failed at: ${failedAtStepMB}MB`);
          }
        }, 300_000);

        it.only('should test incremental updates with varying step sizes', async () => {
          const workflowName = 'varying_size_accumulation_test';
          const runId = 'run_' + Date.now();

          const initialSnapshot = {
            runId,
            status: 'running',
            value: {},
            context: { input: {} } as any,
            result: {},
            serializedStepGraph: [],
            activePaths: [],
            suspendedPaths: {},
            waitingPaths: {},
            timestamp: Date.now(),
          } as WorkflowRunState;

          await store.persistWorkflowSnapshot({ workflowName, runId, snapshot: initialSnapshot });

          const stepSizes = [10, 100, 100];
          let totalMB = 0;
          let successfulSteps = 0;
          const results: { step: number; sizeMB: number; totalMB: number; success: boolean }[] = [];

          for (let i = 0; i < stepSizes.length; i++) {
            const stepSizeMB = stepSizes[i]!;
            const stepId = `step_${i}`;
            const stepData = 'X'.repeat(stepSizeMB * 1024 * 1024);

            try {
              await store.updateWorkflowResults({
                workflowName,
                runId,
                stepId,
                result: {
                  status: 'success',
                  output: { data: stepData },
                  payload: {},
                  startedAt: Date.now(),
                  endedAt: Date.now(),
                  metadata: { size: stepSizeMB, index: i },
                } as any,
                runtimeContext: {},
              });

              const loadedSnapshot = await store.loadWorkflowSnapshot({ workflowName, runId });
              expect(loadedSnapshot).toBeDefined();

              const contextKeys = Object.keys(loadedSnapshot?.context || {}).filter(k => k.startsWith('step_'));
              expect(contextKeys.length).toBe(i + 1);

              const stepResult = loadedSnapshot?.context[stepId];
              expect(stepResult).toBeDefined();
              expect((stepResult as any).output.data).toEqual(stepData);

              const snapshotString = JSON.stringify(loadedSnapshot);
              const actualSizeMB = Math.round(snapshotString.length / 1024 / 1024);

              totalMB += stepSizeMB;
              successfulSteps++;
              results.push({ step: i + 1, sizeMB: stepSizeMB, totalMB, success: true });
              console.log(
                `✓ Step ${i + 1}: Added ${stepSizeMB}MB (total: ${totalMB}MB) | Actual snapshot size: ${actualSizeMB}MB | Steps in context: ${contextKeys.length}`,
              );
            } catch (error: any) {
              results.push({ step: i + 1, sizeMB: stepSizeMB, totalMB, success: false });
              console.log(`✗ Step ${i + 1}: Failed to add ${stepSizeMB}MB at total ${totalMB}MB`);
              break;
            }
          }

          expect(successfulSteps).toBeGreaterThan(0);
          console.log('Results:', results);
          const loadedSnapshot = await store.loadWorkflowSnapshot({ workflowName, runId });
          expect(loadedSnapshot).toBeDefined();
        }, 300_000);

        it('should test mixed content types accumulation', async () => {
          const workflowName = 'mixed_content_test';
          const runId = 'run_' + Date.now();

          const initialSnapshot = {
            runId,
            status: 'running',
            value: {},
            context: { input: {} } as any,
            result: {},
            serializedStepGraph: [],
            activePaths: [],
            suspendedPaths: {},
            waitingPaths: {},
            timestamp: Date.now(),
          } as WorkflowRunState;

          await store.persistWorkflowSnapshot({ workflowName, runId, snapshot: initialSnapshot });

          const testPatterns = [
            { type: 'string', size: 20, generate: (sizeMB: number) => 'A'.repeat(sizeMB * 1024 * 1024) },
            {
              type: 'array',
              size: 20,
              generate: (sizeMB: number) =>
                Array.from({ length: sizeMB * 256 }, (_, i) => ({
                  id: i,
                  data: 'B'.repeat(4000),
                })),
            },
            {
              type: 'object',
              size: 20,
              generate: (sizeMB: number) => ({
                large: 'C'.repeat(sizeMB * 1024 * 1024),
                meta: { timestamp: Date.now() },
              }),
            },
          ];

          let totalMB = 0;
          let successfulUpdates = 0;

          for (let i = 0; i < testPatterns.length; i++) {
            const pattern = testPatterns[i]!;
            const stepId = `${pattern.type}_step_${i}`;

            try {
              const data = pattern.generate(pattern.size);
              await store.updateWorkflowResults({
                workflowName,
                runId,
                stepId,
                result: {
                  status: 'success',
                  output: { type: pattern.type, data },
                  payload: {},
                  startedAt: Date.now(),
                  endedAt: Date.now(),
                } as any,
                runtimeContext: {},
              });

              totalMB += pattern.size;
              successfulUpdates++;
              console.log(`✓ Added ${pattern.type} data: ${pattern.size}MB (total: ${totalMB}MB)`);
            } catch (error: any) {
              console.log(`✗ Failed to add ${pattern.type} data at ${totalMB}MB:`, error.message);
              break;
            }
          }

          expect(successfulUpdates).toBeGreaterThan(0);
          console.log(`Mixed content test completed: ${successfulUpdates}/${testPatterns.length} patterns succeeded`);
          const loadedSnapshot = await store.loadWorkflowSnapshot({ workflowName, runId });
          expect(loadedSnapshot).toBeDefined();
        }, 300_000);
      });

      describe('Heap Out of Memory Prevention', () => {
        it('should handle multiple large workflow executions without crashing', async () => {
          const createLargeWorkflowSnapshot = (runNumber: number): WorkflowRunState => {
            // Create a large object that simulates a real workflow with large context
            const largeContext = {
              dealData: 'X'.repeat(100 * 1024 * 1024), // 100MB of context data
              messages: Array.from({ length: 1000 }, (_, i) => ({
                role: 'user',
                content: 'Y'.repeat(10 * 1024), // 10KB per message
                metadata: { index: i, timestamp: Date.now() },
              })),
              citations: Array.from({ length: 500 }, (_, i) => ({
                id: `citation_${i}`,
                text: 'Z'.repeat(5 * 1024), // 5KB per citation
                source: `source_${i}`,
              })),
            };

            const largeResult = {
              stepOutputs: {
                step1: 'A'.repeat(50 * 1024 * 1024), // 50MB
                step2: 'B'.repeat(50 * 1024 * 1024), // 50MB
                step3: 'C'.repeat(50 * 1024 * 1024), // 50MB
              },
              generatedContent: 'D'.repeat(30 * 1024 * 1024), // 30MB
            };

            return {
              runId: `run_${runNumber}_${Date.now()}`,
              status: 'running',
              value: {},
              context: largeContext as any,
              result: largeResult,
              serializedStepGraph: [],
              activePaths: [],
              suspendedPaths: {},
              waitingPaths: {},
              timestamp: Date.now(),
            } as WorkflowRunState;
          };

          // Simulate multiple workflow executions like in the GitHub issue
          const errors: Error[] = [];

          for (let i = 1; i <= 3; i++) {
            try {
              const snapshot = createLargeWorkflowSnapshot(i);
              await store.persistWorkflowSnapshot({
                workflowName: `memory_test_workflow`,
                runId: snapshot.runId,
                snapshot,
              });
              // Should not reach here
              expect.fail('Large snapshot should have been rejected');
            } catch (error: any) {
              errors.push(error);
              // Verify the error has our custom fields
              expect(error.id).toBeDefined();
              expect(error.id).toMatch(/MASTRA_STORAGE_PAYLOAD_TOO_LARGE|MASTRA_STORAGE_JSON_STRINGIFY_FAILED/);
            }
          }

          // All 3 executions should fail with our size limit error
          expect(errors.length).toBe(3);

          // Verify we get proper error messages, not heap crashes
          errors.forEach(error => {
            expect(error.message).toMatch(
              /Workflow snapshot too large|JSON\.stringify failed|Database query formatting failed/,
            );
          });
        }, 120_000);

        it('should prevent memory accumulation with size limit enforcement', async () => {
          // This test shows how our size checking prevents memory issues
          const sizes = [50, 100, 150, 200, 250]; // Gradually increasing sizes in MB

          let failedAtSize = 0;

          for (const sizeMB of sizes) {
            const largeString = 'X'.repeat(sizeMB * 1024 * 1024);
            const snapshot = {
              runId: `run_${sizeMB}_${Date.now()}`,
              status: 'running',
              value: {},
              context: { input: {} } as any,
              result: { largeData: largeString },
              serializedStepGraph: [],
              activePaths: [],
              suspendedPaths: {},
              waitingPaths: {},
              timestamp: Date.now(),
            } as WorkflowRunState;

            try {
              await store.persistWorkflowSnapshot({
                workflowName: `gradual_test_${sizeMB}`,
                runId: snapshot.runId,
                snapshot,
              });
            } catch (error: any) {
              // Should get our specific error messages
              expect(error.message).toMatch(
                /Workflow snapshot too large|JSON\.stringify failed|Database query formatting failed/,
              );

              // Record when we hit the limit
              if (failedAtSize === 0) {
                failedAtSize = sizeMB;
              }
            }

            // Try to free memory
            if (global.gc) {
              global.gc();
            }
          }

          // We should have hit the limit at 250MB (our limit is 200MB)
          expect(failedAtSize).toBe(250);
        }, 120_000);
      });
    });

    describe('PgStorage Table Name Quoting', () => {
      const camelCaseTable = 'TestCamelCaseTable';
      const snakeCaseTable = 'test_snake_case_table';
      const BASE_SCHEMA = {
        id: { type: 'integer', primaryKey: true, nullable: false },
        name: { type: 'text', nullable: true },
        createdAt: { type: 'timestamp', nullable: false },
        updatedAt: { type: 'timestamp', nullable: false },
      } as Record<string, StorageColumn>;

      beforeEach(async () => {
        // Only clear tables if store is initialized
        try {
          // Clear tables before each test
          await store.clearTable({ tableName: camelCaseTable as TABLE_NAMES });
          await store.clearTable({ tableName: snakeCaseTable as TABLE_NAMES });
        } catch (error) {
          // Ignore errors during table clearing
          console.warn('Error clearing tables:', error);
        }
      });

      afterEach(async () => {
        // Only clear tables if store is initialized
        try {
          // Clear tables before each test
          await store.clearTable({ tableName: camelCaseTable as TABLE_NAMES });
          await store.clearTable({ tableName: snakeCaseTable as TABLE_NAMES });
        } catch (error) {
          // Ignore errors during table clearing
          console.warn('Error clearing tables:', error);
        }
      });

      it('should create and upsert to a camelCase table without quoting errors', async () => {
        await expect(
          store.createTable({
            tableName: camelCaseTable as TABLE_NAMES,
            schema: BASE_SCHEMA,
          }),
        ).resolves.not.toThrow();

        await store.insert({
          tableName: camelCaseTable as TABLE_NAMES,
          record: { id: '1', name: 'Alice', createdAt: new Date(), updatedAt: new Date() },
        });

        const row: any = await store.load({
          tableName: camelCaseTable as TABLE_NAMES,
          keys: { id: '1' },
        });
        expect(row?.name).toBe('Alice');
      });

      it('should create and upsert to a snake_case table without quoting errors', async () => {
        await expect(
          store.createTable({
            tableName: snakeCaseTable as TABLE_NAMES,
            schema: BASE_SCHEMA,
          }),
        ).resolves.not.toThrow();

        await store.insert({
          tableName: snakeCaseTable as TABLE_NAMES,
          record: { id: '2', name: 'Bob', createdAt: new Date(), updatedAt: new Date() },
        });

        const row: any = await store.load({
          tableName: snakeCaseTable as TABLE_NAMES,
          keys: { id: '2' },
        });
        expect(row?.name).toBe('Bob');
      });
    });

    describe('Permission Handling', () => {
      const schemaRestrictedUser = 'mastra_schema_restricted_storage';
      const restrictedPassword = 'test123';
      const testSchema = 'testSchema';
      let adminDb: pgPromise.IDatabase<{}>;
      let pgpAdmin: pgPromise.IMain;

      beforeAll(async () => {
        // Re-initialize the main store for subsequent tests

        await store.init();

        // Create a separate pg-promise instance for admin operations
        pgpAdmin = pgPromise();
        adminDb = pgpAdmin(connectionString);
        try {
          await adminDb.tx(async t => {
            // Drop the test schema if it exists from previous runs
            await t.none(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);

            // Create schema restricted user with minimal permissions
            await t.none(`          
                DO $$
                BEGIN
                  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${schemaRestrictedUser}') THEN
                    CREATE USER ${schemaRestrictedUser} WITH PASSWORD '${restrictedPassword}' NOCREATEDB;
                  END IF;
                END
                $$;`);

            // Grant only connect and usage to schema restricted user
            await t.none(`
                  REVOKE ALL ON DATABASE ${(TEST_CONFIG as any).database} FROM ${schemaRestrictedUser};
                  GRANT CONNECT ON DATABASE ${(TEST_CONFIG as any).database} TO ${schemaRestrictedUser};
                  REVOKE ALL ON SCHEMA public FROM ${schemaRestrictedUser};
                  GRANT USAGE ON SCHEMA public TO ${schemaRestrictedUser};
                `);
          });
        } catch (error) {
          // Clean up the database connection on error
          pgpAdmin.end();
          throw error;
        }
      });

      afterAll(async () => {
        try {
          // Then clean up test user in admin connection
          await adminDb.tx(async t => {
            await t.none(`
                  REASSIGN OWNED BY ${schemaRestrictedUser} TO postgres;
                  DROP OWNED BY ${schemaRestrictedUser};
                  DROP USER IF EXISTS ${schemaRestrictedUser};
                `);
          });

          // Finally clean up admin connection
          if (pgpAdmin) {
            pgpAdmin.end();
          }
        } catch (error) {
          console.error('Error cleaning up test user:', error);
          if (pgpAdmin) pgpAdmin.end();
        }
      });

      describe('Schema Creation', () => {
        beforeEach(async () => {
          // Create a fresh connection for each test
          const tempPgp = pgPromise();
          const tempDb = tempPgp(connectionString);

          try {
            // Ensure schema doesn't exist before each test
            await tempDb.none(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);

            // Ensure no active connections from restricted user
            await tempDb.none(`
                  SELECT pg_terminate_backend(pid) 
                  FROM pg_stat_activity 
                  WHERE usename = '${schemaRestrictedUser}'
                `);
          } finally {
            tempPgp.end(); // Always clean up the connection
          }
        });

        afterEach(async () => {
          // Create a fresh connection for cleanup
          const tempPgp = pgPromise();
          const tempDb = tempPgp(connectionString);

          try {
            // Clean up any connections from the restricted user and drop schema
            await tempDb.none(`
                  DO $$
                  BEGIN
                    -- Terminate connections
                    PERFORM pg_terminate_backend(pid) 
                    FROM pg_stat_activity 
                    WHERE usename = '${schemaRestrictedUser}';
      
                    -- Drop schema
                    DROP SCHEMA IF EXISTS ${testSchema} CASCADE;
                  END $$;
                `);
          } catch (error) {
            console.error('Error in afterEach cleanup:', error);
          } finally {
            tempPgp.end(); // Always clean up the connection
          }
        });

        it('should fail when user lacks CREATE privilege', async () => {
          const restrictedDB = new PostgresStore({
            ...TEST_CONFIG,
            user: schemaRestrictedUser,
            password: restrictedPassword,
            schemaName: testSchema,
          });

          // Create a fresh connection for verification
          const tempPgp = pgPromise();
          const tempDb = tempPgp(connectionString);

          try {
            // Test schema creation by initializing the store
            await expect(async () => {
              await restrictedDB.init();
            }).rejects.toThrow(
              `Unable to create schema "${testSchema}". This requires CREATE privilege on the database.`,
            );

            // Verify schema was not created
            const exists = await tempDb.oneOrNone(
              `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)`,
              [testSchema],
            );
            expect(exists?.exists).toBe(false);
          } finally {
            await restrictedDB.close();
            tempPgp.end(); // Clean up the verification connection
          }
        });

        it('should fail with schema creation error when saving thread', async () => {
          const restrictedDB = new PostgresStore({
            ...TEST_CONFIG,
            user: schemaRestrictedUser,
            password: restrictedPassword,
            schemaName: testSchema,
          });

          // Create a fresh connection for verification
          const tempPgp = pgPromise();
          const tempDb = tempPgp(connectionString);

          try {
            await expect(async () => {
              await restrictedDB.init();
              const thread = createSampleThread();
              await restrictedDB.saveThread({ thread });
            }).rejects.toThrow(
              `Unable to create schema "${testSchema}". This requires CREATE privilege on the database.`,
            );

            // Verify schema was not created
            const exists = await tempDb.oneOrNone(
              `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)`,
              [testSchema],
            );
            expect(exists?.exists).toBe(false);
          } finally {
            await restrictedDB.close();
            tempPgp.end(); // Clean up the verification connection
          }
        });
      });
    });

    describe('Function Namespace in Schema', () => {
      const testSchema = 'schema_fn_test';
      let testStore: PostgresStore;

      beforeAll(async () => {
        // Use a temp connection to set up schema
        const tempPgp = pgPromise();
        const tempDb = tempPgp(connectionString);

        try {
          await tempDb.none(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
          await tempDb.none(`CREATE SCHEMA ${testSchema}`);
          // Drop the function from public schema if it exists from other tests
          await tempDb.none(`DROP FUNCTION IF EXISTS public.trigger_set_timestamps() CASCADE`);
        } finally {
          tempPgp.end();
        }

        testStore = new PostgresStore({
          ...TEST_CONFIG,
          schemaName: testSchema,
        });
        await testStore.init();
      });

      afterAll(async () => {
        await testStore?.close();

        // Use a temp connection to clean up
        const tempPgp = pgPromise();
        const tempDb = tempPgp(connectionString);

        try {
          await tempDb.none(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
        } finally {
          tempPgp.end();
        }
      });

      it('should create trigger function in the correct schema namespace', async () => {
        const aiSpansSchema = {
          id: { type: 'text', primaryKey: true, nullable: false },
          name: { type: 'text', nullable: true },
          createdAt: { type: 'timestamp', nullable: false },
          updatedAt: { type: 'timestamp', nullable: false },
        } as Record<string, StorageColumn>;

        await testStore.createTable({
          tableName: 'mastra_ai_spans' as TABLE_NAMES,
          schema: aiSpansSchema,
        });

        // Verify trigger function exists in the correct schema
        const functionInfo = await testStore.db.oneOrNone(
          `SELECT p.proname, n.nspname
           FROM pg_proc p
           JOIN pg_namespace n ON p.pronamespace = n.oid
           WHERE n.nspname = $1 AND p.proname = 'trigger_set_timestamps'`,
          [testSchema],
        );

        expect(functionInfo).toBeDefined();
        expect(functionInfo?.proname).toBe('trigger_set_timestamps');
        expect(functionInfo?.nspname).toBe(testSchema);

        // Verify function does NOT exist in public schema
        const publicFunction = await testStore.db.oneOrNone(
          `SELECT p.proname, n.nspname
           FROM pg_proc p
           JOIN pg_namespace n ON p.pronamespace = n.oid
           WHERE n.nspname = 'public' AND p.proname = 'trigger_set_timestamps'`,
        );

        expect(publicFunction).toBeNull();
      });
    });

    describe('Timestamp Fallback Handling', () => {
      let testThreadId: string;
      let testResourceId: string;
      let testMessageId: string;

      beforeAll(async () => {
        store = new PostgresStore(TEST_CONFIG);
        await store.init();
      });
      afterAll(async () => {
        try {
          await store.close();
        } catch {}
      });

      beforeEach(async () => {
        testThreadId = `thread-${Date.now()}`;
        testResourceId = `resource-${Date.now()}`;
        testMessageId = `msg-${Date.now()}`;
      });

      it('should use createdAtZ over createdAt for messages when both exist', async () => {
        // Create a thread first
        const thread = createSampleThread({ id: testThreadId, resourceId: testResourceId });
        await store.saveThread({ thread });

        // Directly insert a message with both createdAt and createdAtZ where they differ
        const createdAtValue = new Date('2024-01-01T10:00:00Z');
        const createdAtZValue = new Date('2024-01-01T15:00:00Z'); // 5 hours later - clearly different

        await store.db.none(
          `INSERT INTO mastra_messages (id, thread_id, content, role, type, "resourceId", "createdAt", "createdAtZ")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [testMessageId, testThreadId, 'Test message', 'user', 'v2', testResourceId, createdAtValue, createdAtZValue],
        );

        // Test getMessages
        const messages = await store.getMessages({ threadId: testThreadId, format: 'v2' });
        expect(messages.length).toBe(1);
        expect(messages[0]?.createdAt).toBeInstanceOf(Date);
        expect(messages[0]?.createdAt.getTime()).toBe(createdAtZValue.getTime());
        expect(messages[0]?.createdAt.getTime()).not.toBe(createdAtValue.getTime());

        // Test getMessagesById
        const messagesById = await store.getMessagesById({ messageIds: [testMessageId], format: 'v2' });
        expect(messagesById.length).toBe(1);
        expect(messagesById[0]?.createdAt).toBeInstanceOf(Date);
        expect(messagesById[0]?.createdAt.getTime()).toBe(createdAtZValue.getTime());
        expect(messagesById[0]?.createdAt.getTime()).not.toBe(createdAtValue.getTime());

        // Test getMessagesPaginated
        const messagesPaginated = await store.getMessagesPaginated({
          threadId: testThreadId,
          format: 'v2',
        });
        expect(messagesPaginated.messages.length).toBe(1);
        expect(messagesPaginated.messages[0]?.createdAt).toBeInstanceOf(Date);
        expect(messagesPaginated.messages[0]?.createdAt.getTime()).toBe(createdAtZValue.getTime());
        expect(messagesPaginated.messages[0]?.createdAt.getTime()).not.toBe(createdAtValue.getTime());
      });

      it('should fallback to createdAt when createdAtZ is null for legacy messages', async () => {
        // Create a thread first
        const thread = createSampleThread({ id: testThreadId, resourceId: testResourceId });
        await store.saveThread({ thread });

        // Directly insert a message with only createdAt (simulating old records)
        const createdAtValue = new Date('2024-01-01T10:00:00Z');

        await store.db.none(
          `INSERT INTO mastra_messages (id, thread_id, content, role, type, "resourceId", "createdAt", "createdAtZ")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`,
          [testMessageId, testThreadId, 'Legacy message', 'user', 'v2', testResourceId, createdAtValue],
        );

        // Test getMessages
        const messages = await store.getMessages({ threadId: testThreadId, format: 'v2' });
        expect(messages.length).toBe(1);
        expect(messages[0]?.createdAt).toBeInstanceOf(Date);
        expect(messages[0]?.createdAt.getTime()).toBe(createdAtValue.getTime());

        // Test getMessagesById
        const messagesById = await store.getMessagesById({ messageIds: [testMessageId], format: 'v2' });
        expect(messagesById.length).toBe(1);
        expect(messagesById[0]?.createdAt).toBeInstanceOf(Date);
        expect(messagesById[0]?.createdAt.getTime()).toBe(createdAtValue.getTime());

        // Test getMessagesPaginated
        const messagesPaginated = await store.getMessagesPaginated({
          threadId: testThreadId,
          format: 'v2',
        });
        expect(messagesPaginated.messages.length).toBe(1);
        expect(messagesPaginated.messages[0]?.createdAt).toBeInstanceOf(Date);
        expect(messagesPaginated.messages[0]?.createdAt.getTime()).toBe(createdAtValue.getTime());
      });

      it('should have consistent timestamp handling between threads and messages', async () => {
        // Create a thread first with a known createdAt timestamp
        const threadCreatedAt = new Date('2024-01-01T10:00:00Z');
        const thread = createSampleThread({ id: testThreadId, resourceId: testResourceId });
        thread.createdAt = threadCreatedAt;
        await store.saveThread({ thread });

        // Save a message through the normal API with a different timestamp
        const messageCreatedAt = new Date('2024-01-01T12:00:00Z');
        await store.saveMessages({
          messages: [
            {
              id: testMessageId,
              threadId: testThreadId,
              resourceId: testResourceId,
              role: 'user',
              content: { format: 2, parts: [{ type: 'text', text: 'Test' }], content: 'Test' },
              createdAt: messageCreatedAt,
            },
          ],
          format: 'v2',
        });

        // Get thread
        const retrievedThread = await store.getThreadById({ threadId: testThreadId });
        expect(retrievedThread).toBeTruthy();
        expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
        expect(retrievedThread?.createdAt.getTime()).toBe(threadCreatedAt.getTime());

        // Get messages
        const messages = await store.getMessages({ threadId: testThreadId, format: 'v2' });
        expect(messages.length).toBe(1);
        expect(messages[0]?.createdAt).toBeInstanceOf(Date);
        expect(messages[0]?.createdAt.getTime()).toBe(messageCreatedAt.getTime());
      });

      it('should handle included messages with correct timestamp fallback', async () => {
        // Create a thread
        const thread = createSampleThread({ id: testThreadId, resourceId: testResourceId });
        await store.saveThread({ thread });

        // Create multiple messages
        const msg1Id = `${testMessageId}-1`;
        const msg2Id = `${testMessageId}-2`;
        const msg3Id = `${testMessageId}-3`;

        const date1 = new Date('2024-01-01T10:00:00Z');
        const date2 = new Date('2024-01-01T11:00:00Z');
        const date2Z = new Date('2024-01-01T16:00:00Z'); // Different from date2
        const date3 = new Date('2024-01-01T12:00:00Z');

        // Insert messages with different createdAt/createdAtZ combinations
        // msg1: has createdAtZ (should use it)
        await store.db.none(
          `INSERT INTO mastra_messages (id, thread_id, content, role, type, "resourceId", "createdAt", "createdAtZ")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [msg1Id, testThreadId, 'Message 1', 'user', 'v2', testResourceId, date1, date1],
        );

        // msg2: has NULL createdAtZ (should fallback to createdAt)
        await store.db.none(
          `INSERT INTO mastra_messages (id, thread_id, content, role, type, "resourceId", "createdAt", "createdAtZ")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`,
          [msg2Id, testThreadId, 'Message 2', 'assistant', 'v2', testResourceId, date2],
        );

        // msg3: has both createdAt and createdAtZ with different values (should use createdAtZ)
        await store.db.none(
          `INSERT INTO mastra_messages (id, thread_id, content, role, type, "resourceId", "createdAt", "createdAtZ")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [msg3Id, testThreadId, 'Message 3', 'user', 'v2', testResourceId, date3, date2Z],
        );

        // Test getMessages with include
        const messages = await store.getMessages({
          threadId: testThreadId,
          format: 'v2',
          selectBy: {
            include: [
              {
                id: msg2Id,
                withPreviousMessages: 1,
                withNextMessages: 1,
              },
            ],
          },
        });

        expect(messages.length).toBe(3);

        // Find each message and verify correct timestamps
        const message1 = messages.find(m => m.id === msg1Id);
        expect(message1).toBeDefined();
        expect(message1?.createdAt).toBeInstanceOf(Date);
        expect(message1?.createdAt.getTime()).toBe(date1.getTime());

        const message2 = messages.find(m => m.id === msg2Id);
        expect(message2).toBeDefined();
        expect(message2?.createdAt).toBeInstanceOf(Date);
        expect(message2?.createdAt.getTime()).toBe(date2.getTime());

        const message3 = messages.find(m => m.id === msg3Id);
        expect(message3).toBeDefined();
        expect(message3?.createdAt).toBeInstanceOf(Date);
        // Should use createdAtZ (date2Z), not createdAt (date3)
        expect(message3?.createdAt.getTime()).toBe(date2Z.getTime());
        expect(message3?.createdAt.getTime()).not.toBe(date3.getTime());
      });
    });

    describe('Validation', () => {
      const validConfig = TEST_CONFIG as any;

      describe('Connection String Config', () => {
        it('throws if connectionString is empty', () => {
          expect(() => new PostgresStore({ connectionString: '' })).toThrow();
          expect(() => new PostgresStore({ ...validConfig, connectionString: '' })).toThrow();
        });
        it('does not throw on non-empty connection string', () => {
          expect(() => new PostgresStore({ connectionString })).not.toThrow();
        });
      });

      describe('TCP Host Config', () => {
        it('throws if host is missing or empty', () => {
          expect(() => new PostgresStore({ ...validConfig, host: '' })).toThrow();
          const { host, ...rest } = validConfig;
          expect(() => new PostgresStore(rest as any)).toThrow();
        });
        it('throws if database is missing or empty', () => {
          expect(() => new PostgresStore({ ...validConfig, database: '' })).toThrow();
          const { database, ...rest } = validConfig;
          expect(() => new PostgresStore(rest as any)).toThrow();
        });
        it('throws if user is missing or empty', () => {
          expect(() => new PostgresStore({ ...validConfig, user: '' })).toThrow();
          const { user, ...rest } = validConfig;
          expect(() => new PostgresStore(rest as any)).toThrow();
        });
        it('throws if password is missing or empty', () => {
          expect(() => new PostgresStore({ ...validConfig, password: '' })).toThrow();
          const { password, ...rest } = validConfig;
          expect(() => new PostgresStore(rest as any)).toThrow();
        });
        it('does not throw on valid config (host-based)', () => {
          expect(() => new PostgresStore(validConfig)).not.toThrow();
        });
      });

      describe('Cloud SQL Connector Config', () => {
        it('accepts config with stream property (Cloud SQL connector)', () => {
          const connectorConfig = {
            user: 'test-user',
            database: 'test-db',
            ssl: { rejectUnauthorized: false },
            stream: () => ({}), // Mock stream function
          };
          expect(() => new PostgresStore(connectorConfig as any)).not.toThrow();
        });

        it('accepts config with password function (IAM auth)', () => {
          const iamConfig = {
            user: 'test-user',
            database: 'test-db',
            host: 'localhost', // This could be present but ignored when password is a function
            port: 5432,
            password: () => Promise.resolve('dynamic-token'), // Mock password function
            ssl: { rejectUnauthorized: false },
          };
          expect(() => new PostgresStore(iamConfig as any)).not.toThrow();
        });

        it('accepts generic pg ClientConfig', () => {
          const clientConfig = {
            user: 'test-user',
            database: 'test-db',
            application_name: 'test-app',
            ssl: { rejectUnauthorized: false },
            stream: () => ({}), // Mock stream
          };
          expect(() => new PostgresStore(clientConfig as any)).not.toThrow();
        });
      });

      describe('SSL Configuration', () => {
        it('accepts connectionString with ssl: true', () => {
          expect(() => new PostgresStore({ connectionString, ssl: true })).not.toThrow();
        });

        it('accepts connectionString with ssl object', () => {
          expect(
            () =>
              new PostgresStore({
                connectionString,
                ssl: { rejectUnauthorized: false },
              }),
          ).not.toThrow();
        });

        it('accepts host config with ssl: true', () => {
          const config = {
            ...validConfig,
            ssl: true,
          };
          expect(() => new PostgresStore(config)).not.toThrow();
        });

        it('accepts host config with ssl object', () => {
          const config = {
            ...validConfig,
            ssl: { rejectUnauthorized: false },
          };
          expect(() => new PostgresStore(config)).not.toThrow();
        });
      });

      describe('Pool Options', () => {
        it('accepts max and idleTimeoutMillis with connectionString', () => {
          const config = {
            connectionString,
            max: 30,
            idleTimeoutMillis: 60000,
          };
          expect(() => new PostgresStore(config)).not.toThrow();
        });

        it('accepts max and idleTimeoutMillis with host config', () => {
          const config = {
            ...validConfig,
            max: 30,
            idleTimeoutMillis: 60000,
          };
          expect(() => new PostgresStore(config)).not.toThrow();
        });
      });

      describe('Schema Configuration', () => {
        it('accepts schemaName with connectionString', () => {
          expect(() => new PostgresStore({ connectionString, schemaName: 'custom_schema' })).not.toThrow();
        });

        it('accepts schemaName with host config', () => {
          const config = {
            ...validConfig,
            schemaName: 'custom_schema',
          };
          expect(() => new PostgresStore(config)).not.toThrow();
        });
      });

      describe('Invalid Config', () => {
        it('throws on invalid config (missing required fields)', () => {
          expect(() => new PostgresStore({ user: 'test' } as any)).toThrow(
            /invalid config.*Provide either.*connectionString.*host.*ClientConfig/,
          );
        });

        it('throws on completely empty config', () => {
          expect(() => new PostgresStore({} as any)).toThrow(
            /invalid config.*Provide either.*connectionString.*host.*ClientConfig/,
          );
        });
      });

      describe('Store Initialization', () => {
        it('throws if store is not initialized', () => {
          expect(() => new PostgresStore(validConfig).db.any('SELECT 1')).toThrow(
            /PostgresStore: Store is not initialized/,
          );
          expect(() => new PostgresStore(validConfig).pgp).toThrow(/PostgresStore: Store is not initialized/);
        });
      });
    });
  });
}
