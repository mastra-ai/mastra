import { createSampleThread } from '@internal/storage-test-utils';
import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
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
      it('throws if connectionString is empty', () => {
        expect(() => new PostgresStore({ connectionString: '' })).toThrow();
        expect(() => new PostgresStore({ ...validConfig, connectionString: '' })).toThrow();
      });
      it('throws if host is missing or empty', () => {
        expect(() => new PostgresStore({ ...validConfig, host: '' })).toThrow();
        const { host, ...rest } = validConfig;
        expect(() => new PostgresStore(rest as any)).toThrow();
      });
      it('throws if connectionString is empty', () => {
        expect(() => new PostgresStore({ connectionString: '' })).toThrow();
        const { database, ...rest } = validConfig;
        expect(() => new PostgresStore(rest as any)).toThrow();
      });
      it('throws if user is missing or empty', () => {
        expect(() => new PostgresStore({ ...validConfig, user: '' })).toThrow();
        const { user, ...rest } = validConfig;
        expect(() => new PostgresStore(rest as any)).toThrow();
      });
      it('throws if database is missing or empty', () => {
        expect(() => new PostgresStore({ ...validConfig, database: '' })).toThrow();
        const { database, ...rest } = validConfig;
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
      it('does not throw on non-empty connection string', () => {
        expect(() => new PostgresStore({ connectionString })).not.toThrow();
      });
      it('throws if store is not initialized', () => {
        expect(() => new PostgresStore(validConfig).db.any('SELECT 1')).toThrow(
          /PostgresStore: Store is not initialized/,
        );
        expect(() => new PostgresStore(validConfig).pgp).toThrow(/PostgresStore: Store is not initialized/);
      });
    });
  });
}
