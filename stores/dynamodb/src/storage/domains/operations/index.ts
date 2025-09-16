import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  StoreOperations,
  TABLE_AI_SPANS,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import type { Service } from 'electrodb';

export class StoreOperationsDynamoDB extends StoreOperations {
  client: DynamoDBDocumentClient;
  tableName: string;
  service: Service<Record<string, any>>;
  constructor({
    service,
    tableName,
    client,
  }: {
    service: Service<Record<string, any>>;
    tableName: string;
    client: DynamoDBDocumentClient;
  }) {
    super();
    this.service = service;
    this.client = client;
    this.tableName = tableName;
  }

  async hasColumn(): Promise<boolean> {
    return true;
  }

  async dropTable(): Promise<void> {}

  // Helper methods for entity/table mapping
  private getEntityNameForTable(tableName: TABLE_NAMES): string | null {
    const mapping: Record<TABLE_NAMES, string> = {
      [TABLE_THREADS]: 'thread',
      [TABLE_MESSAGES]: 'message',
      [TABLE_WORKFLOW_SNAPSHOT]: 'workflow_snapshot',
      [TABLE_EVALS]: 'eval',
      [TABLE_SCORERS]: 'score',
      [TABLE_TRACES]: 'trace',
      [TABLE_RESOURCES]: 'resource',
      [TABLE_AI_SPANS]: 'ai_span',
    };
    return mapping[tableName] || null;
  }

  /**
   * Pre-processes a record to ensure Date objects are converted to ISO strings
   * This is necessary because ElectroDB validation happens before setters are applied
   */
  private preprocessRecord(record: Record<string, any>): Record<string, any> {
    const processed = { ...record };

    // Convert Date objects to ISO strings for date fields
    // This prevents ElectroDB validation errors that occur when Date objects are passed
    // to string-typed attributes, even when the attribute has a setter that converts dates
    if (processed.createdAt instanceof Date) {
      processed.createdAt = processed.createdAt.toISOString();
    }
    if (processed.updatedAt instanceof Date) {
      processed.updatedAt = processed.updatedAt.toISOString();
    }
    if (processed.created_at instanceof Date) {
      processed.created_at = processed.created_at.toISOString();
    }

    // Convert result field to JSON string if it's an object
    if (processed.result && typeof processed.result === 'object') {
      processed.result = JSON.stringify(processed.result);
    }

    // Convert test_info field to JSON string if it's an object, or remove if undefined/null
    if (processed.test_info && typeof processed.test_info === 'object') {
      processed.test_info = JSON.stringify(processed.test_info);
    } else if (processed.test_info === undefined || processed.test_info === null) {
      delete processed.test_info;
    }

    // Convert snapshot field to JSON string if it's an object
    if (processed.snapshot && typeof processed.snapshot === 'object') {
      processed.snapshot = JSON.stringify(processed.snapshot);
    }

    // Convert trace-specific fields to JSON strings if they're objects
    // These fields have set/get functions in the entity but validation happens before set
    if (processed.attributes && typeof processed.attributes === 'object') {
      processed.attributes = JSON.stringify(processed.attributes);
    }

    if (processed.status && typeof processed.status === 'object') {
      processed.status = JSON.stringify(processed.status);
    }

    if (processed.events && typeof processed.events === 'object') {
      processed.events = JSON.stringify(processed.events);
    }

    if (processed.links && typeof processed.links === 'object') {
      processed.links = JSON.stringify(processed.links);
    }

    return processed;
  }

  /**
   * Validates that the required DynamoDB table exists and is accessible.
   * This does not check the table structure - it assumes the table
   * was created with the correct structure via CDK/CloudFormation.
   */
  private async validateTableExists(): Promise<boolean> {
    try {
      const command = new DescribeTableCommand({
        TableName: this.tableName,
      });

      // If the table exists, this call will succeed
      // If the table doesn't exist, it will throw a ResourceNotFoundException
      await this.client.send(command);
      return true;
    } catch (error: any) {
      // If the table doesn't exist, DynamoDB returns a ResourceNotFoundException
      if (error.name === 'ResourceNotFoundException') {
        return false;
      }

      // For other errors (like permissions issues), we should throw
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_VALIDATE_TABLE_EXISTS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName: this.tableName },
        },
        error,
      );
    }
  }

  /**
   * This method is modified for DynamoDB with ElectroDB single-table design.
   * It assumes the table is created and managed externally via CDK/CloudFormation.
   *
   * This implementation only validates that the required table exists and is accessible.
   * No table creation is attempted - we simply check if we can access the table.
   */
  async createTable({ tableName }: { tableName: TABLE_NAMES; schema: Record<string, any> }): Promise<void> {
    this.logger.debug('Validating access to externally managed table', { tableName, physicalTable: this.tableName });

    // For single-table design, we just need to verify the table exists and is accessible
    try {
      const tableExists = await this.validateTableExists();

      if (!tableExists) {
        this.logger.error(
          `Table ${this.tableName} does not exist or is not accessible. It should be created via CDK/CloudFormation.`,
        );
        throw new Error(
          `Table ${this.tableName} does not exist or is not accessible. Ensure it's created via CDK/CloudFormation before using this store.`,
        );
      }

      this.logger.debug(`Table ${this.tableName} exists and is accessible`);
    } catch (error) {
      this.logger.error('Error validating table access', { tableName: this.tableName, error });
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_VALIDATE_TABLE_ACCESS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName: this.tableName },
        },
        error,
      );
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    this.logger.debug('DynamoDB insert called', { tableName });

    const entityName = this.getEntityNameForTable(tableName);
    if (!entityName || !this.service.entities[entityName]) {
      throw new MastraError({
        id: 'STORAGE_DYNAMODB_STORE_INSERT_INVALID_ARGS',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'No entity defined for tableName',
        details: { tableName },
      });
    }

    try {
      // Add the entity type to the record and preprocess before creating
      const dataToSave = { entity: entityName, ...this.preprocessRecord(record) };
      await this.service.entities[entityName].create(dataToSave).go();
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async alterTable(_args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    // Nothing to do here, DynamoDB has a flexible schema and handles new attributes automatically upon insertion/update.
  }

  /**
   * Clear all items from a logical "table" (entity type)
   */
  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    this.logger.debug('DynamoDB clearTable called', { tableName });

    const entityName = this.getEntityNameForTable(tableName)!;

    if (!entityName || !this.service.entities[entityName]) {
      throw new MastraError({
        id: 'STORAGE_DYNAMODB_STORE_CLEAR_TABLE_INVALID_ARGS',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'No entity defined for tableName',
        details: { tableName },
      });
    }

    try {
      // Scan requires no key, just uses the entity handler
      const result = await this.service.entities[entityName].scan.go({ pages: 'all' }); // Get all pages

      if (!result.data.length) {
        this.logger.debug(`No records found to clear for ${tableName}`);
        return;
      }

      this.logger.debug(`Found ${result.data.length} records to delete for ${tableName}`);

      // ElectroDB batch delete expects the key components for each item
      const keysToDelete = result.data.map((item: any) => {
        const key: { entity: string; [key: string]: any } = { entity: entityName };

        // Construct the key based on the specific entity's primary key structure
        switch (entityName) {
          case 'thread':
            if (!item.id) throw new Error(`Missing required key 'id' for entity 'thread'`);
            key.id = item.id;
            break;
          case 'message':
            if (!item.id) throw new Error(`Missing required key 'id' for entity 'message'`);
            key.id = item.id;
            break;
          case 'workflow_snapshot':
            if (!item.workflow_name)
              throw new Error(`Missing required key 'workflow_name' for entity 'workflow_snapshot'`);
            if (!item.run_id) throw new Error(`Missing required key 'run_id' for entity 'workflow_snapshot'`);
            key.workflow_name = item.workflow_name;
            key.run_id = item.run_id;
            break;
          case 'eval':
            // Assuming 'eval' uses 'run_id' or another unique identifier as part of its PK
            // Adjust based on the actual primary key defined in getElectroDbService
            if (!item.run_id) throw new Error(`Missing required key 'run_id' for entity 'eval'`);
            // Add other key components if necessary for 'eval' PK
            key.run_id = item.run_id;
            // Example: if global_run_id is also part of PK:
            // if (!item.global_run_id) throw new Error(`Missing required key 'global_run_id' for entity 'eval'`);
            // key.global_run_id = item.global_run_id;
            break;
          case 'trace':
            // Assuming 'trace' uses 'id' as its PK
            // Adjust based on the actual primary key defined in getElectroDbService
            if (!item.id) throw new Error(`Missing required key 'id' for entity 'trace'`);
            key.id = item.id;
            break;
          case 'score':
            // Score entity uses 'id' as its PK
            if (!item.id) throw new Error(`Missing required key 'id' for entity 'score'`);
            key.id = item.id;
            break;
          default:
            // Handle unknown entity types - log a warning or throw an error
            this.logger.warn(`Unknown entity type encountered during clearTable: ${entityName}`);
            // Optionally throw an error if strict handling is required
            throw new Error(`Cannot construct delete key for unknown entity type: ${entityName}`);
        }

        return key;
      });

      const batchSize = 25;
      for (let i = 0; i < keysToDelete.length; i += batchSize) {
        const batchKeys = keysToDelete.slice(i, i + batchSize);
        // Pass the array of key objects to delete
        await this.service.entities[entityName].delete(batchKeys).go();
      }

      this.logger.debug(`Successfully cleared all records for ${tableName}`);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_CLEAR_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  /**
   * Insert multiple records as a batch
   */
  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    this.logger.debug('DynamoDB batchInsert called', { tableName, count: records.length });

    const entityName = this.getEntityNameForTable(tableName);
    if (!entityName || !this.service.entities[entityName]) {
      throw new MastraError({
        id: 'STORAGE_DYNAMODB_STORE_BATCH_INSERT_INVALID_ARGS',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'No entity defined for tableName',
        details: { tableName },
      });
    }

    // Add entity type and preprocess each record
    const recordsToSave = records.map(rec => ({ entity: entityName, ...this.preprocessRecord(rec) }));

    // ElectroDB has batch limits of 25 items, so we need to chunk
    const batchSize = 25;
    const batches = [];
    for (let i = 0; i < recordsToSave.length; i += batchSize) {
      const batch = recordsToSave.slice(i, i + batchSize);
      batches.push(batch);
    }

    try {
      // Process each batch
      for (const batch of batches) {
        // Create each item individually within the batch
        for (const recordData of batch) {
          if (!recordData.entity) {
            this.logger.error('Missing entity property in record data for batchInsert', { recordData, tableName });
            throw new Error(`Internal error: Missing entity property during batchInsert for ${tableName}`);
          }
          // Log the object just before the create call
          this.logger.debug('Attempting to create record in batchInsert:', { entityName, recordData });
          await this.service.entities[entityName].create(recordData).go();
        }
        // Original batch call: await this.service.entities[entityName].create(batch).go();
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_BATCH_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  /**
   * Load a record by its keys
   */
  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    this.logger.debug('DynamoDB load called', { tableName, keys });

    const entityName = this.getEntityNameForTable(tableName);
    if (!entityName || !this.service.entities[entityName]) {
      throw new MastraError({
        id: 'STORAGE_DYNAMODB_STORE_LOAD_INVALID_ARGS',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'No entity defined for tableName',
        details: { tableName },
      });
    }

    try {
      // Add the entity type to the key object for the .get call
      const keyObject = { entity: entityName, ...keys };
      const result = await this.service.entities[entityName].get(keyObject).go();

      if (!result.data) {
        return null;
      }

      // Add parsing logic if necessary (e.g., for metadata)
      let data = result.data;
      if (data.metadata && typeof data.metadata === 'string') {
        try {
          // data.metadata = JSON.parse(data.metadata); // REMOVED by AI
        } catch {
          /* ignore parse error */
        }
      }
      // Add similar parsing for other JSON fields if needed based on entity type

      return data as R;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_LOAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }
}
