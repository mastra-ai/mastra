import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { StorageThreadType, MastraDBMessage } from '@mastra/core/memory';

import { MastraStorage } from '@mastra/core/storage';
import type {
  WorkflowRun,
  WorkflowRuns,
  StorageDomains,
  StorageResourceType,
  StorageListWorkflowRunsInput,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import type { Service } from 'electrodb';
import { getElectroDbService } from '../entities';
import { EvalsStorageDynamoDB } from './domains/evals';
import { MemoryStorageDynamoDB } from './domains/memory';
import { WorkflowStorageDynamoDB } from './domains/workflows';

export interface DynamoDBStoreConfig {
  id: string;
  region?: string;
  tableName: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

// Define a type for our service that allows string indexing
type MastraService = Service<Record<string, any>> & {
  [key: string]: any;
};

export { EvalsStorageDynamoDB as EvalsStorage } from './domains/evals';
export { MemoryStorageDynamoDB as MemoryStorage } from './domains/memory';
export { WorkflowStorageDynamoDB as WorkflowsStorage } from './domains/workflows';

export class DynamoDBStore extends MastraStorage {
  private tableName: string;
  private client: DynamoDBDocumentClient;
  private service: MastraService;
  protected hasInitialized: Promise<boolean> | null = null;
  stores: StorageDomains;

  constructor({ name, config }: { name: string; config: DynamoDBStoreConfig }) {
    super({ id: config.id, name });

    // Validate required config
    try {
      if (!config.tableName || typeof config.tableName !== 'string' || config.tableName.trim() === '') {
        throw new Error('DynamoDBStore: config.tableName must be provided and cannot be empty.');
      }
      // Validate tableName characters (basic check)
      if (!/^[a-zA-Z0-9_.-]{3,255}$/.test(config.tableName)) {
        throw new Error(
          `DynamoDBStore: config.tableName "${config.tableName}" contains invalid characters or is not between 3 and 255 characters long.`,
        );
      }

      const dynamoClient = new DynamoDBClient({
        region: config.region || 'us-east-1',
        endpoint: config.endpoint,
        credentials: config.credentials,
      });

      this.tableName = config.tableName;
      this.client = DynamoDBDocumentClient.from(dynamoClient);
      this.service = getElectroDbService(this.client, this.tableName) as MastraService;

      // Domains will get shared init getter
      const getSharedInit = () => this.hasInitialized;

      const workflows = new WorkflowStorageDynamoDB({
        dynamoClient: this.client,
        tableName: this.tableName,
        getSharedInit,
      });

      const memory = new MemoryStorageDynamoDB({
        dynamoClient: this.client,
        tableName: this.tableName,
        getSharedInit,
      });

      const evals = new EvalsStorageDynamoDB({
        dynamoClient: this.client,
        tableName: this.tableName,
        getSharedInit,
      });

      this.stores = {
        workflows,
        memory,
        evals,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_CONSTRUCTOR_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }

    // We're using a single table design with ElectroDB,
    // so we don't need to create multiple tables
  }

  get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: false,
      createTable: false,
      deleteMessages: false,
      listScoresBySpan: true,
    };
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
   * Initialize storage, validating the externally managed table is accessible.
   * For the single-table design, we only validate once that we can access
   * the table that was created via CDK/CloudFormation.
   */
  async init(): Promise<void> {
    if (this.hasInitialized === null) {
      // If no initialization promise exists, create and store it.
      // This assignment ensures that even if multiple calls arrive here concurrently,
      // they will all eventually await the same promise instance created by the first one
      // to complete this assignment.
      this.hasInitialized = this._performInitializationAndStore();
    }

    try {
      // Await the stored promise.
      // If initialization was successful, this resolves.
      // If it failed, this will re-throw the error caught and re-thrown by _performInitializationAndStore.
      await this.hasInitialized;
    } catch (error) {
      // The error has already been handled by _performInitializationAndStore
      // (i.e., this.hasInitialized was reset). Re-throwing here ensures
      // the caller of init() is aware of the failure.
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_INIT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName: this.tableName },
        },
        error,
      );
    }
  }

  /**
   * Performs the actual table validation and stores the promise.
   * Handles resetting the stored promise on failure to allow retries.
   */
  private _performInitializationAndStore(): Promise<boolean> {
    return this.validateTableExists()
      .then(exists => {
        if (!exists) {
          throw new Error(
            `Table ${this.tableName} does not exist or is not accessible. Ensure it's created via CDK/CloudFormation before using this store.`,
          );
        }
        // Successfully initialized
        return true;
      })
      .catch(err => {
        // Initialization failed. Clear the stored promise to allow future calls to init() to retry.
        this.hasInitialized = null;
        // Re-throw the error so it can be caught by the awaiter in init()
        throw err;
      });
  }

  // Thread operations
  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.stores.memory.getThreadById({ threadId });
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    return this.stores.memory.saveThread({ thread });
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    return this.stores.memory.updateThread({ id, title, metadata });
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    return this.stores.memory.deleteThread({ threadId });
  }

  async listMessagesById(args: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    return this.stores.memory.listMessagesById(args);
  }

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    return this.stores.memory.saveMessages(args);
  }

  async updateMessages(_args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraDBMessage[]> {
    return this.stores.memory.updateMessages(_args);
  }

  // Workflow operations
  async updateWorkflowResults({
    workflowId,
    runId,
    stepId,
    result,
    requestContext,
  }: {
    workflowId: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    return this.stores.workflows.updateWorkflowResults({ workflowId, runId, stepId, result, requestContext });
  }

  async updateWorkflowState({
    workflowId,
    runId,
    opts,
  }: {
    workflowId: string;
    runId: string;
    opts: {
      status: string;
      result?: StepResult<any, any, any, any>;
      error?: string;
      suspendedPaths?: Record<string, number[]>;
      waitingPaths?: Record<string, number[]>;
    };
  }): Promise<WorkflowRunState | undefined> {
    return this.stores.workflows.updateWorkflowState({ workflowId, runId, opts });
  }

  async createWorkflowSnapshot({
    workflowId,
    runId,
    resourceId,
    snapshot,
  }: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    return this.stores.workflows.createWorkflowSnapshot({ workflowId, runId, resourceId, snapshot });
  }

  async getWorkflowSnapshot({
    workflowId,
    runId,
  }: {
    workflowId: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    return this.stores.workflows.getWorkflowSnapshot({ workflowId, runId });
  }

  async listWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns> {
    return this.stores.workflows.listWorkflowRuns(args);
  }

  async getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null> {
    return this.stores.workflows.getWorkflowRunById(args);
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    return this.stores.memory.getResourceById({ resourceId });
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    return this.stores.memory.saveResource({ resource });
  }

  async updateResource({
    resourceId,
    workingMemory,
    metadata,
  }: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, any>;
  }): Promise<StorageResourceType> {
    return this.stores.memory.updateResource({ resourceId, workingMemory, metadata });
  }

  /**
   * Closes the DynamoDB client connection and cleans up resources.
   * Should be called when the store is no longer needed, e.g., at the end of tests or application shutdown.
   */
  public async close(): Promise<void> {
    this.logger.debug('Closing DynamoDB client for store:', { name: this.name });
    try {
      this.client.destroy();
      this.logger.debug('DynamoDB client closed successfully for store:', { name: this.name });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_CLOSE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
