import { getSchemaValidator, SchemaUpdateValidationError } from '../../../datasets/validation';
import type {
  DatasetRecord,
  DatasetItem,
  DatasetItemRow,
  DatasetVersion,
  CreateDatasetInput,
  UpdateDatasetInput,
  AddDatasetItemInput,
  UpdateDatasetItemInput,
  ListDatasetsInput,
  ListDatasetsOutput,
  ListDatasetItemsInput,
  ListDatasetItemsOutput,
  ListDatasetVersionsInput,
  ListDatasetVersionsOutput,
  BatchInsertItemsInput,
  BatchDeleteItemsInput,
} from '../../types';
import { StorageDomain } from '../base';

/**
 * Abstract base class for datasets storage domain.
 * Provides the contract for dataset and dataset item CRUD operations.
 *
 * Schema validation is handled in this base class via Template Method pattern.
 * Subclasses implement protected _do* methods for actual storage operations,
 * including SCD-2 versioning (version bump, row ops, dataset_version insert).
 */
export abstract class DatasetsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'DATASETS',
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    // Default no-op - subclasses override
  }

  // Dataset CRUD
  abstract createDataset(input: CreateDatasetInput): Promise<DatasetRecord>;
  abstract getDatasetById(args: { id: string }): Promise<DatasetRecord | null>;
  abstract deleteDataset(args: { id: string }): Promise<void>;
  abstract listDatasets(args: ListDatasetsInput): Promise<ListDatasetsOutput>;

  /**
   * Update a dataset. Validates existing items against new schemas if schemas are changing.
   * Subclasses implement _doUpdateDataset for actual storage operation.
   */
  async updateDataset(args: UpdateDatasetInput): Promise<DatasetRecord> {
    const existing = await this.getDatasetById({ id: args.id });
    if (!existing) {
      throw new Error(`Dataset not found: ${args.id}`);
    }

    // Check if schemas are being added or modified
    const inputSchemaChanging =
      args.inputSchema !== undefined && JSON.stringify(args.inputSchema) !== JSON.stringify(existing.inputSchema);
    const groundTruthSchemaChanging =
      args.groundTruthSchema !== undefined &&
      JSON.stringify(args.groundTruthSchema) !== JSON.stringify(existing.groundTruthSchema);
    const requestContextSchemaChanging =
      args.requestContextSchema !== undefined &&
      JSON.stringify(args.requestContextSchema) !== JSON.stringify(existing.requestContextSchema);

    // If schemas changing, validate all existing items against new schemas
    if (inputSchemaChanging || groundTruthSchemaChanging || requestContextSchemaChanging) {
      const itemsResult = await this.listItems({
        datasetId: args.id,
        pagination: { page: 0, perPage: false }, // Get all items
      });
      const items = itemsResult.items;

      if (items.length > 0) {
        const validator = getSchemaValidator();
        const newInputSchema = args.inputSchema !== undefined ? args.inputSchema : existing.inputSchema;
        const newOutputSchema =
          args.groundTruthSchema !== undefined ? args.groundTruthSchema : existing.groundTruthSchema;
        const newRequestContextSchema =
          args.requestContextSchema !== undefined ? args.requestContextSchema : existing.requestContextSchema;

        const result = validator.validateBatch(
          items.map(i => ({ input: i.input, groundTruth: i.groundTruth, requestContext: i.requestContext })),
          newInputSchema,
          newOutputSchema,
          `dataset:${args.id}:schema-update`,
          10, // Max 10 errors to report
          newRequestContextSchema,
        );

        if (result.invalid.length > 0) {
          throw new SchemaUpdateValidationError(result.invalid);
        }

        // Clear old cache since schema changed
        validator.clearCache(`dataset:${args.id}:input`);
        validator.clearCache(`dataset:${args.id}:output`);
        validator.clearCache(`dataset:${args.id}:requestContext`);
      }
    }

    return this._doUpdateDataset(args);
  }

  /** Subclasses implement actual storage update logic */
  protected abstract _doUpdateDataset(args: UpdateDatasetInput): Promise<DatasetRecord>;

  /**
   * Add an item to a dataset. Validates input/groundTruth against dataset schemas.
   * Subclasses implement _doAddItem which handles SCD-2 versioning internally.
   */
  async addItem(args: AddDatasetItemInput): Promise<DatasetItem> {
    const dataset = await this.getDatasetById({ id: args.datasetId });
    if (!dataset) {
      throw new Error(`Dataset not found: ${args.datasetId}`);
    }

    // Validate against schemas if enabled
    const validator = getSchemaValidator();
    const cacheKey = `dataset:${args.datasetId}`;

    if (dataset.inputSchema) {
      validator.validate(args.input, dataset.inputSchema, 'input', `${cacheKey}:input`);
    }

    if (dataset.groundTruthSchema && args.groundTruth !== undefined) {
      validator.validate(args.groundTruth, dataset.groundTruthSchema, 'groundTruth', `${cacheKey}:output`);
    }

    if (dataset.requestContextSchema && args.requestContext !== undefined) {
      validator.validate(
        args.requestContext,
        dataset.requestContextSchema,
        'requestContext',
        `${cacheKey}:requestContext`,
      );
    }

    return this._doAddItem(args);
  }

  /** Subclasses implement actual storage add logic with SCD-2 versioning */
  protected abstract _doAddItem(args: AddDatasetItemInput): Promise<DatasetItem>;

  /**
   * Update an item in a dataset. Validates changed fields against dataset schemas.
   * Subclasses implement _doUpdateItem which handles SCD-2 versioning internally.
   */
  async updateItem(args: UpdateDatasetItemInput): Promise<DatasetItem> {
    const dataset = await this.getDatasetById({ id: args.datasetId });
    if (!dataset) {
      throw new Error(`Dataset not found: ${args.datasetId}`);
    }

    // Validate new values against schemas if enabled
    const validator = getSchemaValidator();
    const cacheKey = `dataset:${args.datasetId}`;

    if (args.input !== undefined && dataset.inputSchema) {
      validator.validate(args.input, dataset.inputSchema, 'input', `${cacheKey}:input`);
    }

    if (args.groundTruth !== undefined && dataset.groundTruthSchema) {
      validator.validate(args.groundTruth, dataset.groundTruthSchema, 'groundTruth', `${cacheKey}:output`);
    }

    if (args.requestContext !== undefined && dataset.requestContextSchema) {
      validator.validate(
        args.requestContext,
        dataset.requestContextSchema,
        'requestContext',
        `${cacheKey}:requestContext`,
      );
    }

    return this._doUpdateItem(args);
  }

  /** Subclasses implement actual storage update logic with SCD-2 versioning */
  protected abstract _doUpdateItem(args: UpdateDatasetItemInput): Promise<DatasetItem>;

  /**
   * Delete an item from a dataset. Creates a tombstone row via SCD-2.
   * Subclasses implement _doDeleteItem which handles SCD-2 versioning internally.
   */
  async deleteItem(args: { id: string; datasetId: string }): Promise<void> {
    return this._doDeleteItem(args);
  }

  /** Subclasses implement actual storage delete logic with SCD-2 versioning */
  protected abstract _doDeleteItem(args: { id: string; datasetId: string }): Promise<void>;

  abstract listItems(args: ListDatasetItemsInput): Promise<ListDatasetItemsOutput>;
  abstract getItemById(args: { id: string; datasetVersion?: number }): Promise<DatasetItem | null>;

  // SCD-2 queries
  abstract getItemsByVersion(args: { datasetId: string; version: number }): Promise<DatasetItem[]>;
  abstract getItemHistory(itemId: string): Promise<DatasetItemRow[]>;

  // Dataset version methods
  abstract createDatasetVersion(datasetId: string, version: number): Promise<DatasetVersion>;
  abstract listDatasetVersions(input: ListDatasetVersionsInput): Promise<ListDatasetVersionsOutput>;

  /**
   * Batch insert items to a dataset. Validates all items against dataset schemas,
   * then delegates to subclass which handles SCD-2 versioning internally.
   */
  async batchInsertItems(input: BatchInsertItemsInput): Promise<DatasetItem[]> {
    const dataset = await this.getDatasetById({ id: input.datasetId });
    if (!dataset) {
      throw new Error(`Dataset not found: ${input.datasetId}`);
    }

    // Validate all items against schemas
    const validator = getSchemaValidator();
    const cacheKey = `dataset:${input.datasetId}`;

    for (const itemData of input.items) {
      if (dataset.inputSchema) {
        validator.validate(itemData.input, dataset.inputSchema, 'input', `${cacheKey}:input`);
      }
      if (dataset.groundTruthSchema && itemData.groundTruth !== undefined) {
        validator.validate(itemData.groundTruth, dataset.groundTruthSchema, 'groundTruth', `${cacheKey}:output`);
      }
      if (dataset.requestContextSchema && itemData.requestContext !== undefined) {
        validator.validate(
          itemData.requestContext,
          dataset.requestContextSchema,
          'requestContext',
          `${cacheKey}:requestContext`,
        );
      }
    }

    return this._doBatchInsertItems(input);
  }

  /** Subclasses implement batch insert with SCD-2 versioning */
  protected abstract _doBatchInsertItems(input: BatchInsertItemsInput): Promise<DatasetItem[]>;

  /**
   * Batch delete items from a dataset. Creates tombstone rows via SCD-2.
   * Subclasses implement _doBatchDeleteItems which handles SCD-2 versioning internally.
   */
  async batchDeleteItems(input: BatchDeleteItemsInput): Promise<void> {
    const dataset = await this.getDatasetById({ id: input.datasetId });
    if (!dataset) {
      throw new Error(`Dataset not found: ${input.datasetId}`);
    }

    return this._doBatchDeleteItems(input);
  }

  /** Subclasses implement batch delete with SCD-2 versioning */
  protected abstract _doBatchDeleteItems(input: BatchDeleteItemsInput): Promise<void>;
}
