import { getSchemaValidator, SchemaUpdateValidationError } from '../../../datasets/validation';
import { StorageDomain } from '../base';
import type {
  Dataset,
  DatasetItem,
  DatasetItemVersion,
  DatasetVersion,
  CreateDatasetInput,
  UpdateDatasetInput,
  AddDatasetItemInput,
  UpdateDatasetItemInput,
  ListDatasetsInput,
  ListDatasetsOutput,
  ListDatasetItemsInput,
  ListDatasetItemsOutput,
  CreateItemVersionInput,
  ListItemVersionsInput,
  ListItemVersionsOutput,
  ListDatasetVersionsInput,
  ListDatasetVersionsOutput,
  BulkAddItemsInput,
  BulkDeleteItemsInput,
} from '../../types';

/**
 * Abstract base class for datasets storage domain.
 * Provides the contract for dataset and dataset item CRUD operations.
 *
 * Schema validation is handled in this base class via Template Method pattern.
 * Subclasses implement protected _do* methods for actual storage operations.
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
  abstract createDataset(input: CreateDatasetInput): Promise<Dataset>;
  abstract getDatasetById(args: { id: string }): Promise<Dataset | null>;
  abstract deleteDataset(args: { id: string }): Promise<void>;
  abstract listDatasets(args: ListDatasetsInput): Promise<ListDatasetsOutput>;

  /**
   * Update a dataset. Validates existing items against new schemas if schemas are changing.
   * Subclasses implement _doUpdateDataset for actual storage operation.
   */
  async updateDataset(args: UpdateDatasetInput): Promise<Dataset> {
    const existing = await this.getDatasetById({ id: args.id });
    if (!existing) {
      throw new Error(`Dataset not found: ${args.id}`);
    }

    // Check if schemas are being added or modified
    const inputSchemaChanging =
      args.inputSchema !== undefined && JSON.stringify(args.inputSchema) !== JSON.stringify(existing.inputSchema);
    const outputSchemaChanging =
      args.outputSchema !== undefined && JSON.stringify(args.outputSchema) !== JSON.stringify(existing.outputSchema);

    // If schemas changing, validate all existing items against new schemas
    if (inputSchemaChanging || outputSchemaChanging) {
      const itemsResult = await this.listItems({
        datasetId: args.id,
        pagination: { page: 0, perPage: false }, // Get all items
      });
      const items = itemsResult.items;

      if (items.length > 0) {
        const validator = getSchemaValidator();
        const newInputSchema = args.inputSchema !== undefined ? args.inputSchema : existing.inputSchema;
        const newOutputSchema = args.outputSchema !== undefined ? args.outputSchema : existing.outputSchema;

        const result = validator.validateBatch(
          items.map(i => ({ input: i.input, expectedOutput: i.expectedOutput })),
          newInputSchema,
          newOutputSchema,
          `dataset:${args.id}:schema-update`,
          10, // Max 10 errors to report
        );

        if (result.invalid.length > 0) {
          throw new SchemaUpdateValidationError(result.invalid);
        }

        // Clear old cache since schema changed
        validator.clearCache(`dataset:${args.id}:input`);
        validator.clearCache(`dataset:${args.id}:output`);
      }
    }

    return this._doUpdateDataset(args);
  }

  /** Subclasses implement actual storage update logic */
  protected abstract _doUpdateDataset(args: UpdateDatasetInput): Promise<Dataset>;

  /**
   * Add an item to a dataset. Validates input/expectedOutput against dataset schemas.
   * Creates version records for history tracking.
   * Subclasses implement _doAddItem for actual storage operation.
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

    if (dataset.outputSchema && args.expectedOutput !== undefined) {
      validator.validate(args.expectedOutput, dataset.outputSchema, 'expectedOutput', `${cacheKey}:output`);
    }

    // Add the item
    const item = await this._doAddItem(args);

    // Create version records for history tracking
    const now = item.version; // Use the item's version timestamp
    await this.createItemVersion({
      itemId: item.id,
      datasetId: item.datasetId,
      versionNumber: 1,
      datasetVersion: now,
      snapshot: {
        input: item.input,
        expectedOutput: item.expectedOutput,
        context: item.context,
      },
      isDeleted: false,
    });
    await this.createDatasetVersion(item.datasetId, now);

    return item;
  }

  /** Subclasses implement actual storage add logic */
  protected abstract _doAddItem(args: AddDatasetItemInput): Promise<DatasetItem>;

  /**
   * Update an item in a dataset. Validates changed fields against dataset schemas.
   * Creates version records for history tracking.
   * Subclasses implement _doUpdateItem for actual storage operation.
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

    if (args.expectedOutput !== undefined && dataset.outputSchema) {
      validator.validate(args.expectedOutput, dataset.outputSchema, 'expectedOutput', `${cacheKey}:output`);
    }

    // Get current version number before update
    const latestVersion = await this.getLatestItemVersion(args.id);
    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    // Update the item
    const item = await this._doUpdateItem(args);

    // Create version records for history tracking
    const now = item.version; // Use the item's version timestamp
    await this.createItemVersion({
      itemId: item.id,
      datasetId: item.datasetId,
      versionNumber: nextVersionNumber,
      datasetVersion: now,
      snapshot: {
        input: item.input,
        expectedOutput: item.expectedOutput,
        context: item.context,
      },
      isDeleted: false,
    });
    await this.createDatasetVersion(item.datasetId, now);

    return item;
  }

  /** Subclasses implement actual storage update logic */
  protected abstract _doUpdateItem(args: UpdateDatasetItemInput): Promise<DatasetItem>;

  /**
   * Delete an item from a dataset. Creates a tombstone version for history tracking.
   * Subclasses implement _doDeleteItem for actual storage operation.
   */
  async deleteItem(args: { id: string; datasetId: string }): Promise<void> {
    // Get item before delete to capture snapshot
    const item = await this.getItemById({ id: args.id });
    if (!item) {
      // Item doesn't exist, nothing to delete
      return;
    }

    // Get current version number
    const latestVersion = await this.getLatestItemVersion(args.id);
    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    const now = new Date();

    // Create tombstone version record
    await this.createItemVersion({
      itemId: args.id,
      datasetId: args.datasetId,
      versionNumber: nextVersionNumber,
      datasetVersion: now,
      snapshot: {
        input: item.input,
        expectedOutput: item.expectedOutput,
        context: item.context,
      },
      isDeleted: true, // Tombstone marker
    });
    await this.createDatasetVersion(args.datasetId, now);

    // Delete from items table
    await this._doDeleteItem(args);
  }

  /** Subclasses implement actual storage delete logic */
  protected abstract _doDeleteItem(args: { id: string; datasetId: string }): Promise<void>;

  abstract listItems(args: ListDatasetItemsInput): Promise<ListDatasetItemsOutput>;
  abstract getItemById(args: { id: string }): Promise<DatasetItem | null>;

  // Version-aware queries (snapshot semantics: items at or before version timestamp)
  abstract getItemsByVersion(args: { datasetId: string; version: Date }): Promise<DatasetItem[]>;

  // Item version methods
  abstract createItemVersion(input: CreateItemVersionInput): Promise<DatasetItemVersion>;
  abstract getItemVersion(itemId: string, versionNumber?: number): Promise<DatasetItemVersion | null>;
  abstract getLatestItemVersion(itemId: string): Promise<DatasetItemVersion | null>;
  abstract listItemVersions(input: ListItemVersionsInput): Promise<ListItemVersionsOutput>;

  // Dataset version methods
  abstract createDatasetVersion(datasetId: string, version: Date): Promise<DatasetVersion>;
  abstract listDatasetVersions(input: ListDatasetVersionsInput): Promise<ListDatasetVersionsOutput>;

  // Bulk operations (implemented in base with version tracking)
  abstract bulkAddItems(input: BulkAddItemsInput): Promise<DatasetItem[]>;
  abstract bulkDeleteItems(input: BulkDeleteItemsInput): Promise<void>;
}
