import { createSampleThread } from '@internal/storage-test-utils';
import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import type { WorkflowRunState, WorkflowRunStatus } from '@mastra/core/workflows';
import pgPromise from 'pg-promise';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresStore } from '.';
import type { PostgresConfig } from '.';

export const TEST_CONFIG: PostgresConfig = {
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

        it('should fail when string payload exceeds 512MB limit', async () => {
          // Create 3x200MB strings = 600MB total
          const largeString1 = 'A'.repeat(200 * 1024 * 1024);
          const largeString2 = 'B'.repeat(200 * 1024 * 1024);
          const largeString3 = 'C'.repeat(200 * 1024 * 1024);

          const snapshot = {
            runId: 'run_' + Date.now(),
            status: 'running',
            value: {},
            context: { input: {} } as any,
            result: {
              data1: largeString1,
              data2: largeString2,
              data3: largeString3,
            },
            serializedStepGraph: [],
            activePaths: [],
            suspendedPaths: {},
            waitingPaths: {},
            timestamp: Date.now(),
          } as WorkflowRunState;

          const workflowName = 'large_string_fail';
          const runId = snapshot.runId;

          await expect(store.persistWorkflowSnapshot({ workflowName, runId, snapshot })).rejects.toThrow(
            /Invalid string length/i,
          );
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

        it('should fail when object array exceeds 512MB limit', async () => {
          // Array of 150,000 objects, each ~4KB = ~600MB
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

          const workflowName = 'array_fail';
          const runId = snapshot.runId;

          await expect(store.persistWorkflowSnapshot({ workflowName, runId, snapshot })).rejects.toThrow(
            /Invalid string length/i,
          );
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

        it('should fail when multiple fields exceed 512MB limit', async () => {
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

          const workflowName = 'multi_field_fail';
          const runId = snapshot.runId;

          await expect(store.persistWorkflowSnapshot({ workflowName, runId, snapshot })).rejects.toThrow(
            /Invalid string length/i,
          );
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

        it('should fail when deeply nested structure exceeds 512MB limit', async () => {
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

          // This will create exponential growth exceeding 512MB
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

          const workflowName = 'nested_fail';
          const runId = snapshot.runId;

          await expect(store.persistWorkflowSnapshot({ workflowName, runId, snapshot })).rejects.toThrow(
            /Invalid string length/i,
          );
        }, 120_000);
      });

      // Edge Case: Just Under Limit
      describe('Edge Cases', () => {
        it('should store payload approaching practical limit successfully (~250MB)', async () => {
          // Create a payload that's substantial but safely under the observed limit
          const string80MB = 'A'.repeat(80 * 1024 * 1024);
          const array80MB = Array.from({ length: 20000 }, (_, i) => ({
            idx: i,
            data: 'B'.repeat(4000), // ~4KB per entry = ~80MB total
          }));
          const string80MB_2 = 'C'.repeat(80 * 1024 * 1024);

          const snapshot = {
            runId: 'run_' + Date.now(),
            status: 'running',
            value: {},
            context: {
              input: { data: array80MB },
            } as any,
            result: { data: string80MB },
            runtimeContext: { data: string80MB_2 },
            serializedStepGraph: [],
            activePaths: [],
            suspendedPaths: {},
            waitingPaths: {},
            timestamp: Date.now(),
          } as WorkflowRunState;

          const workflowName = 'edge_case_under_limit';
          const runId = snapshot.runId;

          // This should succeed as it's under the practical limit
          await store.persistWorkflowSnapshot({ workflowName, runId, snapshot });

          const loadedSnapshot = await store.loadWorkflowSnapshot({ workflowName, runId });
          expect(loadedSnapshot).toBeDefined();
          expect(loadedSnapshot?.result?.data?.length).toBe(80 * 1024 * 1024);
          expect(loadedSnapshot?.context?.input?.data?.length).toBe(20000);
          expect(loadedSnapshot?.runtimeContext?.data?.length).toBe(80 * 1024 * 1024);
        }, 180_000); // Longer timeout for edge case
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
