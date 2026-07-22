import { getSchemaValidator, SchemaUpdateValidationError } from '../../../datasets/validation';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type {
  DatasetRecord,
  DatasetItem,
  DatasetItemRow,
  DatasetVersion,
  CreateDatasetInput,
  UpdateDatasetInput,
  AddDatasetItemInput,
  UpdateDatasetItemInput,
  DeleteDatasetItemInput,
  ListDatasetsInput,
  ListDatasetsOutput,
  ListDatasetItemsInput,
  ListDatasetItemsOutput,
  ListDatasetVersionsInput,
  ListDatasetVersionsOutput,
  BatchInsertItemsInput,
  BatchDeleteItemsInput,
  DatasetTenancyFilters,
} from '../../types';
import { StorageDomain } from '../base';
import { planDatasetItemBatch as createDatasetItemBatchPlan, validateDatasetItemExternalId } from './identity';
import type { DatasetItemBatchPlan } from './identity';
import { validateDatasetItemPayloadSerialization } from './serialization';

const DATASET_IMMUTABLE_FIELDS = ['organizationId', 'projectId', 'candidateKey', 'candidateId'] as const;

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

  protected validateCallerDefinedDatasetId(id: string): void {
    if (id.length === 0) {
      throw new MastraError({
        id: 'DATASET_INVALID_ID',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { id },
        text: 'Caller-defined dataset ID must not be empty',
      });
    }
  }

  /**
   * Returns an existing dataset when a caller-defined ID is reused compatibly.
   * Optional immutable fields normalize omitted and null values to the same value.
   */
  protected resolveExistingDataset(existing: DatasetRecord, input: CreateDatasetInput & { id: string }): DatasetRecord {
    const hasConflict = DATASET_IMMUTABLE_FIELDS.some(field => (existing[field] ?? null) !== (input[field] ?? null));

    if (hasConflict) {
      throw new MastraError({
        id: 'DATASET_ID_CONFLICT',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: {
          id: input.id,
          reason: 'IMMUTABLE_FIELDS_MISMATCH',
        },
        text: `Dataset ID "${input.id}" is already in use with incompatible immutable fields`,
      });
    }

    return existing;
  }

  async dangerouslyClearAll(): Promise<void> {
    // Default no-op - subclasses override
  }

  // Dataset CRUD
  abstract createDataset(input: CreateDatasetInput): Promise<DatasetRecord>;
  /**
   * Fetch a dataset by ID. When `filters` is provided, the row is only returned
   * if it also matches the tenancy filters — returns `null` on mismatch (never
   * throws, to avoid leaking existence across tenants via error timing/text).
   */
  abstract getDatasetById(args: { id: string; filters?: DatasetTenancyFilters }): Promise<DatasetRecord | null>;
  /**
   * Delete a dataset. When `filters` is provided, the delete is a silent no-op
   * if the row does not match the tenancy filters. Never throws on mismatch.
   */
  abstract deleteDataset(args: { id: string; filters?: DatasetTenancyFilters }): Promise<void>;
  abstract listDatasets(args: ListDatasetsInput): Promise<ListDatasetsOutput>;

  /**
   * Update a dataset. Validates existing items against new schemas if schemas are changing.
   * Subclasses implement _doUpdateDataset for actual storage operation.
   */
  async updateDataset(args: UpdateDatasetInput): Promise<DatasetRecord> {
    const existing = await this.getDatasetById({ id: args.id, filters: args.filters });
    if (!existing) {
      throw new Error(`Dataset not found: ${args.id}`);
    }

    // Check if schemas are being added or modified
    const inputSchemaChanging =
      args.inputSchema !== undefined && JSON.stringify(args.inputSchema) !== JSON.stringify(existing.inputSchema);
    const groundTruthSchemaChanging =
      args.groundTruthSchema !== undefined &&
      JSON.stringify(args.groundTruthSchema) !== JSON.stringify(existing.groundTruthSchema);

    // If schemas changing, validate all existing items against new schemas
    if (inputSchemaChanging || groundTruthSchemaChanging) {
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

        const result = validator.validateBatch(
          items.map(i => ({ input: i.input, groundTruth: i.groundTruth })),
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
  protected abstract _doUpdateDataset(args: UpdateDatasetInput): Promise<DatasetRecord>;

  /**
   * Add an item to a dataset. Validates input/groundTruth against dataset schemas.
   * Subclasses implement _doAddItem which handles SCD-2 versioning internally.
   */
  async addItem(args: AddDatasetItemInput): Promise<DatasetItem> {
    const { datasetId, filters, ...item } = args;
    const [result] = await this.batchInsertItems({ datasetId, filters, items: [item] });
    return result!;
  }

  /** Subclasses implement actual storage add logic with SCD-2 versioning */
  protected abstract _doAddItem(args: AddDatasetItemInput): Promise<DatasetItem>;

  /**
   * Update an item in a dataset. Validates changed fields against dataset schemas.
   * Subclasses implement _doUpdateItem which handles SCD-2 versioning internally.
   */
  async updateItem(args: UpdateDatasetItemInput): Promise<DatasetItem> {
    const dataset = await this.getDatasetById({ id: args.datasetId, filters: args.filters });
    if (!dataset) {
      throw new Error(`Dataset not found: ${args.datasetId}`);
    }

    const { id: _id, datasetId: _datasetId, filters: _filters, ...payload } = args;
    validateDatasetItemPayloadSerialization(payload, 'item');

    // Validate new values against schemas if enabled
    const validator = getSchemaValidator();
    const cacheKey = `dataset:${args.datasetId}`;

    if (args.input !== undefined && dataset.inputSchema) {
      validator.validate(args.input, dataset.inputSchema, 'input', `${cacheKey}:input`);
    }

    if (args.groundTruth !== undefined && dataset.groundTruthSchema) {
      validator.validate(args.groundTruth, dataset.groundTruthSchema, 'groundTruth', `${cacheKey}:output`);
    }

    return this._doUpdateItem(args);
  }

  /** Subclasses implement actual storage update logic with SCD-2 versioning */
  protected abstract _doUpdateItem(args: UpdateDatasetItemInput): Promise<DatasetItem>;

  /**
   * Delete an item from a dataset. Creates a tombstone row via SCD-2.
   * Subclasses implement _doDeleteItem which handles SCD-2 versioning internally.
   *
   * When `args.filters` is set, the delete is a silent no-op if the parent
   * dataset row does not match the tenancy filters — prevents deleting items
   * from a dataset in another tenant via a leaked datasetId.
   */
  async deleteItem(args: DeleteDatasetItemInput): Promise<void> {
    if (args.filters) {
      const dataset = await this.getDatasetById({ id: args.datasetId, filters: args.filters });
      if (!dataset) return;
    }
    return this._doDeleteItem(args);
  }

  /** Subclasses implement actual storage delete logic with SCD-2 versioning */
  protected abstract _doDeleteItem(args: DeleteDatasetItemInput): Promise<void>;

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
    const dataset = await this.getDatasetById({ id: input.datasetId, filters: input.filters });
    if (!dataset) {
      throw new Error(`Dataset not found: ${input.datasetId}`);
    }

    // Validate all items against schemas
    const validator = getSchemaValidator();
    const cacheKey = `dataset:${input.datasetId}`;

    for (const [index, itemData] of input.items.entries()) {
      validateDatasetItemExternalId(itemData.externalId);
      validateDatasetItemPayloadSerialization(itemData, `items[${index}]`);
      if (dataset.inputSchema) {
        validator.validate(itemData.input, dataset.inputSchema, 'input', `${cacheKey}:input`);
      }
      if (dataset.groundTruthSchema && itemData.groundTruth !== undefined) {
        validator.validate(itemData.groundTruth, dataset.groundTruthSchema, 'groundTruth', `${cacheKey}:output`);
      }
    }

    return this._doBatchInsertItems(input);
  }

  protected planDatasetItemBatch(
    items: BatchInsertItemsInput['items'],
    historyRows: DatasetItemRow[],
    createId: () => string,
  ): DatasetItemBatchPlan {
    return createDatasetItemBatchPlan(items, historyRows, createId);
  }

  protected datasetItemFromRow(row: DatasetItemRow): DatasetItem {
    const { validTo: _validTo, isDeleted: _isDeleted, ...item } = row;
    return item;
  }

  /** Subclasses implement batch insert with SCD-2 versioning */
  protected abstract _doBatchInsertItems(input: BatchInsertItemsInput): Promise<DatasetItem[]>;

  /**
   * Batch delete items from a dataset. Creates tombstone rows via SCD-2.
   * Subclasses implement _doBatchDeleteItems which handles SCD-2 versioning internally.
   */
  async batchDeleteItems(input: BatchDeleteItemsInput): Promise<void> {
    const dataset = await this.getDatasetById({ id: input.datasetId, filters: input.filters });
    if (!dataset) {
      throw new Error(`Dataset not found: ${input.datasetId}`);
    }

    return this._doBatchDeleteItems(input);
  }

  /** Subclasses implement batch delete with SCD-2 versioning */
  protected abstract _doBatchDeleteItems(input: BatchDeleteItemsInput): Promise<void>;
}
