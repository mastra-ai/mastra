import { describe, it, expect } from 'vitest';
import { createSqlBuilder } from './sql-builder';

describe('SQL Builder', () => {
  describe('SELECT Queries', () => {
    it('should build a basic SELECT query', () => {
      const builder = createSqlBuilder().select('*').from('users');
      const { sql, params } = builder.build();

      expect(sql).toBe('SELECT * FROM users');
      expect(params).toEqual([]);
    });

    it('should build a SELECT query with specific columns', () => {
      const builder = createSqlBuilder().select(['id', 'name', 'email']).from('users');
      const { sql, params } = builder.build();

      expect(sql).toBe('SELECT id, name, email FROM users');
      expect(params).toEqual([]);
    });

    it('should build a SELECT query with WHERE clause', () => {
      const builder = createSqlBuilder().select('*').from('users').where('id = ?', 123);

      const { sql, params } = builder.build();

      expect(sql).toBe('SELECT * FROM users WHERE id = ?');
      expect(params).toEqual([123]);
    });

    it('should build a SELECT query with multiple WHERE conditions', () => {
      const builder = createSqlBuilder()
        .select('*')
        .from('users')
        .where('id = ?', 123)
        .andWhere('status = ?', 'active');

      const { sql, params } = builder.build();

      expect(sql).toBe('SELECT * FROM users WHERE id = ? AND status = ?');
      expect(params).toEqual([123, 'active']);
    });

    it('should build a SELECT query with ORDER BY clause', () => {
      const builder = createSqlBuilder().select('*').from('users').orderBy('created_at', 'DESC');

      const { sql, params } = builder.build();

      expect(sql).toBe('SELECT * FROM users ORDER BY created_at DESC');
      expect(params).toEqual([]);
    });

    it('should build a SELECT query with LIMIT clause', () => {
      const builder = createSqlBuilder().select('*').from('users').limit(10);

      const { sql, params } = builder.build();

      expect(sql).toBe('SELECT * FROM users LIMIT ?');
      expect(params).toEqual([10]);
    });

    it('should build a complex SELECT query with all clauses', () => {
      const builder = createSqlBuilder()
        .select(['id', 'name', 'email'])
        .from('users')
        .where('id > ?', 100)
        .andWhere('status = ?', 'active')
        .orderBy('created_at', 'DESC')
        .limit(10);

      const { sql, params } = builder.build();

      expect(sql).toBe(
        'SELECT id, name, email FROM users WHERE id > ? AND status = ? ORDER BY created_at DESC LIMIT ?',
      );
      expect(params).toEqual([100, 'active', 10]);
    });
  });

  describe('INSERT Queries', () => {
    it('should build a basic INSERT query with array columns and values', () => {
      const builder = createSqlBuilder().insert('users', ['id', 'name', 'email'], [1, 'John', 'john@example.com']);

      const { sql, params } = builder.build();

      expect(sql).toBe('INSERT INTO users (id, name, email) VALUES (?, ?, ?)');
      expect(params).toEqual([1, 'John', 'john@example.com']);
    });

    it('should handle empty values for INSERT', () => {
      const builder = createSqlBuilder().insert('users', ['id', 'name', 'email'], []);

      const { sql, params } = builder.build();

      expect(sql).toBe('INSERT INTO users (id, name, email) VALUES (?, ?, ?)');
      expect(params).toEqual([]);
    });

    it('should build an INSERT query with ON CONFLICT', () => {
      const builder = createSqlBuilder().insert(
        'users',
        ['id', 'name', 'email'],
        [1, 'John', 'john@example.com'],
        ['id'],
        { name: 'excluded.name' },
      );

      const { sql, params } = builder.build();

      expect(sql).toBe(
        'INSERT INTO users (id, name, email) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name',
      );
      expect(params).toEqual([1, 'John', 'john@example.com']);
    });
  });

  describe('UPDATE Queries', () => {
    it('should build an UPDATE query with array columns and values', () => {
      const builder = createSqlBuilder()
        .update('users', ['name', 'email'], ['John', 'john@example.com'])
        .where('id = ?', 1);

      const { sql, params } = builder.build();

      expect(sql).toBe('UPDATE users SET name = ?, email = ? WHERE id = ?');
      expect(params).toEqual(['John', 'john@example.com', 1]);
    });

    it('should handle UPDATE without WHERE clause', () => {
      const builder = createSqlBuilder().update('users', ['status'], ['inactive']);

      const { sql, params } = builder.build();

      expect(sql).toBe('UPDATE users SET status = ?');
      expect(params).toEqual(['inactive']);
    });
  });

  describe('DELETE Queries', () => {
    it('should build a basic DELETE query', () => {
      const builder = createSqlBuilder().delete('users').where('id = ?', 1);

      const { sql, params } = builder.build();

      expect(sql).toBe('DELETE FROM users WHERE id = ?');
      expect(params).toEqual([1]);
    });

    it('should build a DELETE query with multiple conditions', () => {
      const builder = createSqlBuilder()
        .delete('users')
        .where('status = ?', 'inactive')
        .andWhere('last_login < ?', '2023-01-01');

      const { sql, params } = builder.build();

      expect(sql).toBe('DELETE FROM users WHERE status = ? AND last_login < ?');
      expect(params).toEqual(['inactive', '2023-01-01']);
    });

    it('should handle DELETE without WHERE clause (delete all)', () => {
      const builder = createSqlBuilder().delete('users');

      const { sql, params } = builder.build();

      expect(sql).toBe('DELETE FROM users');
      expect(params).toEqual([]);
    });
  });

  describe('CREATE TABLE Queries', () => {
    it('should build a CREATE TABLE query with array column definitions', () => {
      const builder = createSqlBuilder().createTable('users', [
        'id INTEGER PRIMARY KEY',
        'name TEXT NOT NULL',
        'email TEXT UNIQUE',
        'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      ]);

      const { sql, params } = builder.build();

      expect(sql).toBe(
        'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
      );
      expect(params).toEqual([]);
    });
  });

  describe('Index Operations', () => {
    it('should build a query to check if an index exists', () => {
      const builder = createSqlBuilder().checkIndexExists('idx_users_email', 'users');

      const { sql, params } = builder.build();

      expect(sql).toBe("SELECT name FROM sqlite_master WHERE type='index' AND name=? AND tbl_name=?");
      expect(params).toEqual(['idx_users_email', 'users']);
    });

    it('should build a CREATE INDEX query', () => {
      const builder = createSqlBuilder().createIndex('idx_users_email', 'users', 'email');

      const { sql, params } = builder.build();

      expect(sql).toBe('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
      expect(params).toEqual([]);
    });

    it('should build a CREATE UNIQUE INDEX query', () => {
      const builder = createSqlBuilder().createIndex('idx_users_email', 'users', 'email', 'UNIQUE');

      const { sql, params } = builder.build();

      expect(sql).toBe('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)');
      expect(params).toEqual([]);
    });
  });

  describe('Reset and Reuse', () => {
    it('should reset the builder state', () => {
      const builder = createSqlBuilder().select('*').from('users').where('id = ?', 1);

      const { sql: sql1, params: params1 } = builder.build();
      expect(sql1).toBe('SELECT * FROM users WHERE id = ?');
      expect(params1).toEqual([1]);

      builder.reset();

      const { sql: sql2, params: params2 } = builder.build();
      expect(sql2).toBe('');
      expect(params2).toEqual([]);
    });

    it('should allow reusing the builder after reset', () => {
      const builder = createSqlBuilder().select('*').from('users');

      const { sql: sql1 } = builder.build();
      expect(sql1).toBe('SELECT * FROM users');

      builder.reset().insert('products', ['id', 'name'], [1, 'Product 1']);

      const { sql: sql2, params: params2 } = builder.build();
      expect(sql2).toBe('INSERT INTO products (id, name) VALUES (?, ?)');
      expect(params2).toEqual([1, 'Product 1']);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    // Validation tests for identifier safety
    it('should throw on invalid column name in select', () => {
      expect(() => createSqlBuilder().select(['id', 'name;DROP TABLE users']).from('users')).toThrow(
        /Invalid column name/,
      );
    });
    it('should throw on invalid table name in from', () => {
      expect(() => createSqlBuilder().select().from('users;DROP TABLE foo')).toThrow(/Invalid table name/);
    });
    it('should throw on invalid column name in insert', () => {
      expect(() => createSqlBuilder().insert('users', ['id', 'bad;col'], [1, 2])).toThrow(/Invalid column name/);
    });
    it('should throw on invalid table name in insert', () => {
      expect(() => createSqlBuilder().insert('bad;table', ['id'], [1])).toThrow(/Invalid table name/);
    });
    it('should throw on invalid column name in update', () => {
      expect(() => createSqlBuilder().update('users', ['id', 'bad;col'], [1, 2])).toThrow(/Invalid column name/);
    });
    it('should throw on invalid table name in update', () => {
      expect(() => createSqlBuilder().update('bad;table', ['id'], [1])).toThrow(/Invalid table name/);
    });
    it('should throw on invalid table name in delete', () => {
      expect(() => createSqlBuilder().delete('bad;table')).toThrow(/Invalid table name/);
    });
    it('should throw on invalid table name in createTable', () => {
      expect(() => createSqlBuilder().createTable('bad;table', ['id TEXT'])).toThrow(/Invalid table name/);
    });
    it('should throw on invalid column name in createTable', () => {
      expect(() => createSqlBuilder().createTable('users', ['bad;col TEXT'])).toThrow(/Invalid column name/);
    });
    it('should throw on invalid index name in createIndex', () => {
      expect(() => createSqlBuilder().createIndex('bad;index', 'users', 'id')).toThrow(/Invalid index name/);
    });
    it('should throw on invalid table name in createIndex', () => {
      expect(() => createSqlBuilder().createIndex('idx_id', 'bad;table', 'id')).toThrow(/Invalid table name/);
    });
    it('should throw on invalid column name in createIndex', () => {
      expect(() => createSqlBuilder().createIndex('idx_id', 'users', 'bad;col')).toThrow(/Invalid column name/);
    });
    it('should throw on invalid column name in orderBy', () => {
      expect(() => createSqlBuilder().select().from('users').orderBy('bad;col')).toThrow(/Invalid column name/);
    });
    it('should throw on invalid direction in orderBy', () => {
      expect(() =>
        createSqlBuilder()
          .select()
          .from('users')
          .orderBy('id', 'BAD' as 'ASC' | 'DESC'),
      ).toThrow(/Invalid sort direction/);
    });
    it('should throw on invalid column name in like', () => {
      expect(() => createSqlBuilder().select().from('users').like('bad;col', 'foo')).toThrow(/Invalid column name/);
    });
    it('should throw on invalid column name in jsonLike', () => {
      expect(() => createSqlBuilder().select().from('users').jsonLike('bad;col', 'key', 'val')).toThrow(
        /Invalid column name/,
      );
    });

    it('should handle empty select columns', () => {
      const builder = createSqlBuilder().select().from('users');

      const { sql } = builder.build();
      expect(sql).toBe('SELECT * FROM users');
    });
  });
});
