import { SchemaDefinition, TableDefinition, ColumnDefinition } from './types';

export class SchemaBuilder {
  private schema: SchemaDefinition = {};

  table(name: string): TableBuilder {
    const tableBuilder = new TableBuilder(name);
    this.schema[name] = tableBuilder.build();
    return tableBuilder;
  }

  addTable(name: string, definition: TableDefinition): this {
    this.schema[name] = definition;
    return this;
  }

  build(): SchemaDefinition {
    return this.schema;
  }

  static create(): SchemaBuilder {
    return new SchemaBuilder();
  }
}

export class TableBuilder {
  private definition: TableDefinition = {
    columns: {},
    indexes: {},
    foreignKeys: {},
  };

  constructor(tableName: string) {
    void tableName; // Not used but kept for potential future use
  }

  column(name: string, definition: ColumnDefinition): this {
    this.definition.columns[name] = definition;
    return this;
  }

  id(name: string = 'id'): this {
    return this.column(name, {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
      default: 'uuid_generate_v4()',
    });
  }

  uuid(name: string, options?: Partial<ColumnDefinition>): this {
    return this.column(name, {
      type: 'uuid',
      ...options,
    });
  }

  text(name: string, options?: Partial<ColumnDefinition>): this {
    return this.column(name, {
      type: 'text',
      ...options,
    });
  }

  varchar(name: string, options?: Partial<ColumnDefinition>): this {
    return this.column(name, {
      type: 'varchar',
      ...options,
    });
  }

  integer(name: string, options?: Partial<ColumnDefinition>): this {
    return this.column(name, {
      type: 'integer',
      ...options,
    });
  }

  bigint(name: string, options?: Partial<ColumnDefinition>): this {
    return this.column(name, {
      type: 'bigint',
      ...options,
    });
  }

  boolean(name: string, options?: Partial<ColumnDefinition>): this {
    return this.column(name, {
      type: 'boolean',
      ...options,
    });
  }

  timestamp(name: string, options?: Partial<ColumnDefinition>): this {
    return this.column(name, {
      type: 'timestamp',
      ...options,
    });
  }

  timestamps(): this {
    this.timestamp('created_at', { notNull: true, default: 'now()' });
    this.timestamp('updated_at', { notNull: true, default: 'now()' });
    return this;
  }

  json(name: string, options?: Partial<ColumnDefinition>): this {
    return this.column(name, {
      type: 'json',
      ...options,
    });
  }

  jsonb(name: string, options?: Partial<ColumnDefinition>): this {
    return this.column(name, {
      type: 'jsonb',
      ...options,
    });
  }

  index(name: string, columns: string[], unique = false): this {
    if (!this.definition.indexes) {
      this.definition.indexes = {};
    }
    this.definition.indexes[name] = {
      columns,
      unique,
    };
    return this;
  }

  uniqueIndex(name: string, columns: string[]): this {
    return this.index(name, columns, true);
  }

  foreignKey(
    name: string,
    columns: string[],
    referencedTable: string,
    referencedColumns: string[],
    options?: {
      onDelete?: 'cascade' | 'restrict' | 'set null' | 'no action';
      onUpdate?: 'cascade' | 'restrict' | 'set null' | 'no action';
    },
  ): this {
    if (!this.definition.foreignKeys) {
      this.definition.foreignKeys = {};
    }
    this.definition.foreignKeys[name] = {
      columns,
      references: {
        table: referencedTable,
        columns: referencedColumns,
      },
      ...options,
    };
    return this;
  }

  primaryKey(columns: string | string[]): this {
    this.definition.primaryKey = columns;
    return this;
  }

  build(): TableDefinition {
    return this.definition;
  }
}

// Helper function for common Mastra schema patterns
export function createMastraSchema(): SchemaDefinition {
  const builder = SchemaBuilder.create();

  // Connections table
  builder.addTable('connections', {
    columns: {
      id: { type: 'uuid', primaryKey: true, notNull: true, default: 'uuid_generate_v4()' },
      name: { type: 'text', notNull: true },
      connection_id: { type: 'text', notNull: true, unique: true },
      provider: { type: 'text', notNull: true },
      config: { type: 'jsonb', notNull: true },
      created_at: { type: 'timestamp', notNull: true, default: 'now()' },
      updated_at: { type: 'timestamp', notNull: true, default: 'now()' },
    },
    indexes: {
      idx_connection_id: { columns: ['connection_id'], unique: true },
      idx_provider: { columns: ['provider'] },
    },
  });

  // Entities table
  builder.addTable('entities', {
    columns: {
      id: { type: 'uuid', primaryKey: true, notNull: true, default: 'uuid_generate_v4()' },
      entity_id: { type: 'text', notNull: true, unique: true },
      entity_type: { type: 'text', notNull: true },
      connection_id: { type: 'text', notNull: true },
      data: { type: 'jsonb', notNull: true },
      created_at: { type: 'timestamp', notNull: true, default: 'now()' },
      updated_at: { type: 'timestamp', notNull: true, default: 'now()' },
    },
    indexes: {
      idx_entity_id: { columns: ['entity_id'], unique: true },
      idx_entity_type: { columns: ['entity_type'] },
      idx_connection_id: { columns: ['connection_id'] },
    },
  });

  // Syncs table
  builder.addTable('syncs', {
    columns: {
      id: { type: 'uuid', primaryKey: true, notNull: true, default: 'uuid_generate_v4()' },
      sync_id: { type: 'text', notNull: true, unique: true },
      connection_id: { type: 'text', notNull: true },
      entity_type: { type: 'text', notNull: true },
      status: { type: 'text', notNull: true },
      error: { type: 'text' },
      entities_synced: { type: 'integer', default: 0 },
      started_at: { type: 'timestamp' },
      completed_at: { type: 'timestamp' },
      created_at: { type: 'timestamp', notNull: true, default: 'now()' },
      updated_at: { type: 'timestamp', notNull: true, default: 'now()' },
    },
    indexes: {
      idx_sync_id: { columns: ['sync_id'], unique: true },
      idx_connection_id: { columns: ['connection_id'] },
      idx_status: { columns: ['status'] },
    },
  });

  return builder.build();
}
