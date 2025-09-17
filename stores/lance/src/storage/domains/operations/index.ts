import type { Connection } from '@lancedb/lancedb';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { StoreOperations } from '@mastra/core/storage';
import type { TABLE_NAMES, StorageColumn } from '@mastra/core/storage';
import { Utf8, Int32, Float32, Binary, Schema, Field, Float64 } from 'apache-arrow';
import type { DataType } from 'apache-arrow';
import { getPrimaryKeys, getTableSchema, processResultWithTypeConversion, validateKeyTypes } from '../utils';

export class StoreOperationsLance extends StoreOperations {
  client: Connection;
  constructor({ client }: { client: Connection }) {
    super();
    this.client = client;
  }

  protected getDefaultValue(type: StorageColumn['type']): string {
    switch (type) {
      case 'text':
        return "''";
      case 'timestamp':
        return 'CURRENT_TIMESTAMP';
      case 'integer':
      case 'bigint':
        return '0';
      case 'jsonb':
        return "'{}'";
      case 'uuid':
        return "''";
      default:
        return super.getDefaultValue(type);
    }
  }

  async hasColumn(tableName: TABLE_NAMES, columnName: string): Promise<boolean> {
    const table = await this.client.openTable(tableName);
    const schema = await table.schema();
    return schema.fields.some(field => field.name === columnName);
  }

  private translateSchema(schema: Record<string, StorageColumn>): Schema {
    const fields = Object.entries(schema).map(([name, column]) => {
      // Convert string type to Arrow DataType
      let arrowType: DataType;
      switch (column.type.toLowerCase()) {
        case 'text':
        case 'uuid':
          arrowType = new Utf8();
          break;
        case 'int':
        case 'integer':
          arrowType = new Int32();
          break;
        case 'bigint':
          arrowType = new Float64();
          break;
        case 'float':
          arrowType = new Float32();
          break;
        case 'jsonb':
        case 'json':
          arrowType = new Utf8();
          break;
        case 'binary':
          arrowType = new Binary();
          break;
        case 'timestamp':
          arrowType = new Float64();
          break;
        default:
          // Default to string for unknown types
          arrowType = new Utf8();
      }

      // Create a field with the appropriate arrow type
      return new Field(name, arrowType, column.nullable ?? true);
    });

    return new Schema(fields);
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('LanceDB client not initialized. Call LanceStorage.create() first.');
      }
      if (!tableName) {
        throw new Error('tableName is required for createTable.');
      }
      if (!schema) {
        throw new Error('schema is required for createTable.');
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_LANCE_STORAGE_CREATE_TABLE_INVALID_ARGS',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { tableName },
        },
        error,
      );
    }

    try {
      const arrowSchema = this.translateSchema(schema);
      await this.client.createEmptyTable(tableName, arrowSchema);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        this.logger.debug(`Table '${tableName}' already exists, skipping create`);
        return;
      }
      throw new MastraError(
        {
          id: 'STORAGE_LANCE_STORAGE_CREATE_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('LanceDB client not initialized. Call LanceStorage.create() first.');
      }
      if (!tableName) {
        throw new Error('tableName is required for dropTable.');
      }
    } catch (validationError: any) {
      throw new MastraError(
        {
          id: 'STORAGE_LANCE_STORAGE_DROP_TABLE_INVALID_ARGS',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: validationError.message,
          details: { tableName },
        },
        validationError,
      );
    }

    try {
      await this.client.dropTable(tableName);
    } catch (error: any) {
      if (error.toString().includes('was not found') || error.message?.includes('Table not found')) {
        this.logger.debug(`Table '${tableName}' does not exist, skipping drop`);
        return;
      }
      throw new MastraError(
        {
          id: 'STORAGE_LANCE_STORAGE_DROP_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async alterTable({
    tableName,
    schema,
    ifNotExists,
  }: {
    tableName: string;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('LanceDB client not initialized. Call LanceStorage.create() first.');
      }
      if (!tableName) {
        throw new Error('tableName is required for alterTable.');
      }
      if (!schema) {
        throw new Error('schema is required for alterTable.');
      }
      if (!ifNotExists || ifNotExists.length === 0) {
        this.logger.debug('No columns specified to add in alterTable, skipping.');
        return;
      }
    } catch (validationError: any) {
      throw new MastraError(
        {
          id: 'STORAGE_LANCE_STORAGE_ALTER_TABLE_INVALID_ARGS',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: validationError.message,
          details: { tableName },
        },
        validationError,
      );
    }

    try {
      const table = await this.client.openTable(tableName);
      const currentSchema = await table.schema();
      const existingFields = new Set(currentSchema.fields.map((f: any) => f.name));

      const typeMap: Record<string, string> = {
        text: 'string',
        integer: 'int',
        bigint: 'bigint',
        timestamp: 'timestamp',
        jsonb: 'string',
        uuid: 'string',
      };

      // Find columns to add
      const columnsToAdd = ifNotExists
        .filter(col => schema[col] && !existingFields.has(col))
        .map(col => {
          const colDef = schema[col];
          return {
            name: col,
            valueSql: colDef?.nullable
              ? `cast(NULL as ${typeMap[colDef.type ?? 'text']})`
              : `cast(${this.getDefaultValue(colDef?.type ?? 'text')} as ${typeMap[colDef?.type ?? 'text']})`,
          };
        });

      if (columnsToAdd.length > 0) {
        await table.addColumns(columnsToAdd);
        this.logger?.info?.(`Added columns [${columnsToAdd.map(c => c.name).join(', ')}] to table ${tableName}`);
      }
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'STORAGE_LANCE_STORAGE_ALTER_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('LanceDB client not initialized. Call LanceStorage.create() first.');
      }
      if (!tableName) {
        throw new Error('tableName is required for clearTable.');
      }
    } catch (validationError: any) {
      throw new MastraError(
        {
          id: 'STORAGE_LANCE_STORAGE_CLEAR_TABLE_INVALID_ARGS',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: validationError.message,
          details: { tableName },
        },
        validationError,
      );
    }

    try {
      const table = await this.client.openTable(tableName);

      // delete function always takes a predicate as an argument, so we use '1=1' to delete all records because it is always true.
      await table.delete('1=1');
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'STORAGE_LANCE_STORAGE_CLEAR_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async insert({ tableName, record }: { tableName: string; record: Record<string, any> }): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('LanceDB client not initialized. Call LanceStorage.create() first.');
      }
      if (!tableName) {
        throw new Error('tableName is required for insert.');
      }
      if (!record || Object.keys(record).length === 0) {
        throw new Error('record is required and cannot be empty for insert.');
      }
    } catch (validationError: any) {
      throw new MastraError(
        {
          id: 'STORAGE_LANCE_STORAGE_INSERT_INVALID_ARGS',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: validationError.message,
          details: { tableName },
        },
        validationError,
      );
    }

    try {
      const table = await this.client.openTable(tableName);

      const primaryId = getPrimaryKeys(tableName as TABLE_NAMES);

      const processedRecord = { ...record };

      for (const key in processedRecord) {
        if (
          processedRecord[key] !== null &&
          typeof processedRecord[key] === 'object' &&
          !(processedRecord[key] instanceof Date)
        ) {
          this.logger.debug('Converting object to JSON string: ', processedRecord[key]);
          processedRecord[key] = JSON.stringify(processedRecord[key]);
        }
      }
      console.info(await table.schema());

      await table.mergeInsert(primaryId).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute([processedRecord]);
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'STORAGE_LANCE_STORAGE_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async batchInsert({ tableName, records }: { tableName: string; records: Record<string, any>[] }): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('LanceDB client not initialized. Call LanceStorage.create() first.');
      }
      if (!tableName) {
        throw new Error('tableName is required for batchInsert.');
      }
      if (!records || records.length === 0) {
        throw new Error('records array is required and cannot be empty for batchInsert.');
      }
    } catch (validationError: any) {
      throw new MastraError(
        {
          id: 'STORAGE_LANCE_STORAGE_BATCH_INSERT_INVALID_ARGS',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: validationError.message,
          details: { tableName },
        },
        validationError,
      );
    }

    try {
      const table = await this.client.openTable(tableName);

      const primaryId = getPrimaryKeys(tableName as TABLE_NAMES);

      const processedRecords = records.map(record => {
        const processedRecord = { ...record };

        // Convert values based on schema type
        for (const key in processedRecord) {
          // Skip null/undefined values
          if (processedRecord[key] == null) continue;

          if (
            processedRecord[key] !== null &&
            typeof processedRecord[key] === 'object' &&
            !(processedRecord[key] instanceof Date)
          ) {
            processedRecord[key] = JSON.stringify(processedRecord[key]);
          }
        }

        return processedRecord;
      });

      await table.mergeInsert(primaryId).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute(processedRecords);
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'STORAGE_LANCE_STORAGE_BATCH_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async load({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<any> {
    try {
      if (!this.client) {
        throw new Error('LanceDB client not initialized. Call LanceStorage.create() first.');
      }
      if (!tableName) {
        throw new Error('tableName is required for load.');
      }
      if (!keys || Object.keys(keys).length === 0) {
        throw new Error('keys are required and cannot be empty for load.');
      }
    } catch (validationError: any) {
      throw new MastraError(
        {
          id: 'STORAGE_LANCE_STORAGE_LOAD_INVALID_ARGS',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: validationError.message,
          details: { tableName },
        },
        validationError,
      );
    }

    try {
      const table = await this.client.openTable(tableName);
      const tableSchema = await getTableSchema({ tableName, client: this.client });
      const query = table.query();

      // Build filter condition with 'and' between all conditions
      if (Object.keys(keys).length > 0) {
        // Validate key types against schema
        validateKeyTypes(keys, tableSchema);

        const filterConditions = Object.entries(keys)
          .map(([key, value]) => {
            // Check if key is in camelCase and wrap it in backticks if it is
            const isCamelCase = /^[a-z][a-zA-Z]*$/.test(key) && /[A-Z]/.test(key);
            const quotedKey = isCamelCase ? `\`${key}\`` : key;

            // Handle different types appropriately
            if (typeof value === 'string') {
              return `${quotedKey} = '${value}'`;
            } else if (value === null) {
              return `${quotedKey} IS NULL`;
            } else {
              // For numbers, booleans, etc.
              return `${quotedKey} = ${value}`;
            }
          })
          .join(' AND ');

        this.logger.debug('where clause generated: ' + filterConditions);
        query.where(filterConditions);
      }

      const result = await query.limit(1).toArray();

      if (result.length === 0) {
        this.logger.debug('No record found');
        return null;
      }
      // Process the result with type conversions
      return processResultWithTypeConversion(result[0], tableSchema);
    } catch (error: any) {
      // If it's already a MastraError (e.g. from validateKeyTypes if we change it later), rethrow
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: 'STORAGE_LANCE_STORAGE_LOAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName, keyCount: Object.keys(keys).length, firstKey: Object.keys(keys)[0] ?? '' },
        },
        error,
      );
    }
  }
}
