import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { DrizzleStore } from './index';
import { DialectFactory } from './dialects/factory';
import { SchemaBuilder } from './dialects/schema-builder';

describe('DrizzleStore', () => {
  let store: DrizzleStore;

  describe('SQLite (in-memory)', () => {
    beforeEach(async () => {
      store = new DrizzleStore({
        dialect: 'sqlite',
        connection: {
          database: ':memory:',
        },
      });
      await store.init();
    });

    afterEach(async () => {
      await store.close();
    });

    describe('Connections', () => {
      it('should save and retrieve a connection', async () => {
        const connection = {
          id: 'test-id',
          name: 'Test Connection',
          connectionId: 'conn-123',
          provider: 'test-provider',
          config: { apiKey: 'test-key' },
        };

        const saved = await store.saveConnection(connection);
        expect(saved).toBeDefined();
        expect(saved.connection_id).toBe('conn-123');

        const retrieved = await store.getConnection('conn-123');
        expect(retrieved).toBeDefined();
        expect(retrieved.name).toBe('Test Connection');
        expect(retrieved.provider).toBe('test-provider');
      });

      it('should list all connections', async () => {
        await store.saveConnection({
          id: '1',
          name: 'Connection 1',
          connectionId: 'conn-1',
          provider: 'provider-1',
        });

        await store.saveConnection({
          id: '2',
          name: 'Connection 2',
          connectionId: 'conn-2',
          provider: 'provider-2',
        });

        const connections = await store.listConnections();
        expect(connections).toHaveLength(2);
        expect(connections.map(c => c.connection_id)).toContain('conn-1');
        expect(connections.map(c => c.connection_id)).toContain('conn-2');
      });

      it('should update a connection', async () => {
        await store.saveConnection({
          id: '1',
          name: 'Original Name',
          connectionId: 'conn-1',
          provider: 'provider-1',
        });

        await store.updateConnection('conn-1', {
          name: 'Updated Name',
        });

        const updated = await store.getConnection('conn-1');
        expect(updated.name).toBe('Updated Name');
      });

      it('should delete a connection', async () => {
        await store.saveConnection({
          id: '1',
          name: 'To Delete',
          connectionId: 'conn-delete',
          provider: 'provider-1',
        });

        await store.deleteConnection('conn-delete');

        const deleted = await store.getConnection('conn-delete');
        expect(deleted).toBeNull();
      });
    });

    describe('Entities', () => {
      it('should save and retrieve an entity', async () => {
        const entity = {
          id: 'ent-id',
          entityId: 'entity-123',
          entityType: 'user',
          connectionId: 'conn-123',
          data: { name: 'John Doe', email: 'john@example.com' },
        };

        const saved = await store.saveEntity(entity);
        expect(saved).toBeDefined();

        const retrieved = await store.getEntity('entity-123');
        expect(retrieved).toBeDefined();
        expect(retrieved.entity_type).toBe('user');
        expect(retrieved.data.name).toBe('John Doe');
      });

      it('should list entities with filters', async () => {
        await store.saveEntity({
          id: '1',
          entityId: 'ent-1',
          entityType: 'user',
          connectionId: 'conn-1',
          data: {},
        });

        await store.saveEntity({
          id: '2',
          entityId: 'ent-2',
          entityType: 'post',
          connectionId: 'conn-1',
          data: {},
        });

        await store.saveEntity({
          id: '3',
          entityId: 'ent-3',
          entityType: 'user',
          connectionId: 'conn-2',
          data: {},
        });

        const userEntities = await store.listEntities({ entityType: 'user' });
        expect(userEntities).toHaveLength(2);

        const conn1Entities = await store.listEntities({ connectionId: 'conn-1' });
        expect(conn1Entities).toHaveLength(2);
      });

      it('should upsert entities', async () => {
        const entity = {
          id: '1',
          entityId: 'ent-upsert',
          entityType: 'user',
          connectionId: 'conn-1',
          data: { name: 'Original' },
        };

        // First insert
        await store.upsertEntity(entity);
        let retrieved = await store.getEntity('ent-upsert');
        expect(retrieved.data.name).toBe('Original');

        // Update via upsert
        entity.data.name = 'Updated';
        await store.upsertEntity(entity);
        retrieved = await store.getEntity('ent-upsert');
        expect(retrieved.data.name).toBe('Updated');
      });
    });

    describe('Syncs', () => {
      it('should save and retrieve a sync', async () => {
        const sync = {
          id: 'sync-id',
          syncId: 'sync-123',
          connectionId: 'conn-123',
          entityType: 'user',
          status: 'in_progress',
          entitiesSynced: 0,
          startedAt: new Date(),
        };

        const saved = await store.saveSync(sync);
        expect(saved).toBeDefined();

        const retrieved = await store.getSync('sync-123');
        expect(retrieved).toBeDefined();
        expect(retrieved.status).toBe('in_progress');
      });

      it('should update sync status', async () => {
        await store.saveSync({
          id: '1',
          syncId: 'sync-update',
          connectionId: 'conn-1',
          entityType: 'user',
          status: 'in_progress',
        });

        await store.updateSync('sync-update', {
          status: 'completed',
          entitiesSynced: 100,
          completedAt: new Date(),
        });

        const updated = await store.getSync('sync-update');
        expect(updated.status).toBe('completed');
        expect(updated.entities_synced).toBe(100);
      });
    });

    describe('Transactions', () => {
      it('should handle transactions', async () => {
        const result = await store.transaction(async tx => {
          // Transaction operations would go here
          // For now, just test that transaction method works
          return 'transaction-result';
        });

        expect(result).toBe('transaction-result');
      });
    });

    describe('Raw queries', () => {
      it('should execute raw SQL queries', async () => {
        await store.saveConnection({
          id: '1',
          name: 'Query Test',
          connectionId: 'query-test',
          provider: 'test',
        });

        const results = await store.query(`SELECT * FROM connections WHERE connection_id = ?`, ['query-test']);

        expect(results).toHaveLength(1);
        expect(results[0].connection_id).toBe('query-test');
      });
    });

    describe('Helper methods', () => {
      it('should provide access to database instance', () => {
        const db = store.getDb();
        expect(db).toBeDefined();
      });

      it('should provide access to schemas', () => {
        const schemas = store.getSchemas();
        expect(schemas).toBeDefined();
        expect(schemas.connections).toBeDefined();
        expect(schemas.entities).toBeDefined();
        expect(schemas.syncs).toBeDefined();
      });

      it('should provide access to dialect', () => {
        const dialect = store.getDialect();
        expect(dialect).toBeDefined();
        expect(dialect?.isConnected()).toBe(true);
      });
    });
  });

  describe('Dialect Factory', () => {
    it('should list supported dialects', () => {
      const supported = DialectFactory.getSupported();
      expect(supported).toContain('postgresql');
      expect(supported).toContain('mysql');
      expect(supported).toContain('sqlite');
      expect(supported).toContain('turso');
      expect(supported).toContain('planetscale');
      expect(supported).toContain('neon');
    });

    it('should check if dialect is supported', () => {
      expect(DialectFactory.isSupported('postgresql')).toBe(true);
      expect(DialectFactory.isSupported('mysql')).toBe(true);
      expect(DialectFactory.isSupported('invalid')).toBe(false);
    });
  });

  describe('Schema Builder', () => {
    it('should build table schemas fluently', () => {
      const schema = SchemaBuilder.create()
        .table('users')
        .id()
        .text('name', { notNull: true })
        .text('email', { unique: true })
        .boolean('active', { default: true })
        .timestamps()
        .build();

      expect(schema.users).toBeDefined();
      expect(schema.users.columns.id).toBeDefined();
      expect(schema.users.columns.name).toBeDefined();
      expect(schema.users.columns.email).toBeDefined();
      expect(schema.users.columns.active).toBeDefined();
      expect(schema.users.columns.created_at).toBeDefined();
      expect(schema.users.columns.updated_at).toBeDefined();
    });

    it('should create indexes and foreign keys', () => {
      const builder = SchemaBuilder.create();

      builder
        .table('posts')
        .id()
        .text('title')
        .text('user_id', { notNull: true })
        .index('idx_user_id', ['user_id'])
        .uniqueIndex('idx_title', ['title'])
        .foreignKey('fk_user', ['user_id'], 'users', ['id'], {
          onDelete: 'cascade',
        });

      const schema = builder.build();

      expect(schema.posts.indexes?.idx_user_id).toBeDefined();
      expect(schema.posts.indexes?.idx_title).toBeDefined();
      expect(schema.posts.indexes?.idx_title.unique).toBe(true);
      expect(schema.posts.foreignKeys?.fk_user).toBeDefined();
      expect(schema.posts.foreignKeys?.fk_user.onDelete).toBe('cascade');
    });
  });
});

describe('DrizzleStore with different dialects', () => {
  describe.skip('PostgreSQL', () => {
    let store: DrizzleStore;

    beforeAll(async () => {
      store = new DrizzleStore({
        dialect: 'postgresql',
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'test',
          user: 'postgres',
          password: 'postgres',
        },
      });
      await store.init();
    });

    afterAll(async () => {
      await store.close();
    });

    it('should connect to PostgreSQL', () => {
      expect(store.getDialect()?.isConnected()).toBe(true);
    });
  });

  describe.skip('MySQL', () => {
    let store: DrizzleStore;

    beforeAll(async () => {
      store = new DrizzleStore({
        dialect: 'mysql',
        connection: {
          host: 'localhost',
          port: 3307,
          database: 'test',
          user: 'root',
          password: 'mysql',
        },
      });
      await store.init();
    });

    afterAll(async () => {
      await store.close();
    });

    it('should connect to MySQL', () => {
      expect(store.getDialect()?.isConnected()).toBe(true);
    });
  });
});
