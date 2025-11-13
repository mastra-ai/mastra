import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { Service } from 'electrodb';
import { getElectroDbService } from '../../entities';
import type { DynamoDBStoreConfig } from '../index';

/**
 * Configuration for DynamoDB domain classes supporting both shared and standalone usage
 */
export type DynamoDBDomainConfig =
    | {
        dynamoClient: DynamoDBDocumentClient;
        tableName: string;
        config?: never;
        getSharedInit?: () => Promise<boolean> | null; // Getter for shared initialization promise from DynamoDBStore
    }
    | {
        dynamoClient?: never;
        tableName?: never;
        config: DynamoDBStoreConfig;
        getSharedInit?: never;
    };

/**
 * Base class for DynamoDB storage domains that supports both:
 * 1. Shared client usage (via DynamoDBStore) with shared initialization
 * 2. Standalone usage (creates own client) with independent initialization
 */
export class DynamoDBDomainBase {
    protected service: Service<Record<string, any>>;
    private client: DynamoDBDocumentClient;
    private ownedClient: boolean; // Track if we created the client
    private tableName: string;
    protected hasInitialized: Promise<boolean> | null = null;
    private getSharedInit?: () => Promise<boolean> | null;

    constructor(opts: DynamoDBDomainConfig) {
        if (opts.dynamoClient) {
            // Shared client usage (via DynamoDBStore)
            this.client = opts.dynamoClient;
            this.tableName = opts.tableName;
            this.ownedClient = false;
            this.getSharedInit = opts.getSharedInit;
        } else {
            // Standalone usage - create our own client
            this.tableName = opts.config.tableName;

            const dynamoClient = new DynamoDBClient({
                region: opts.config.region || 'us-east-1',
                endpoint: opts.config.endpoint,
                credentials: opts.config.credentials,
            });

            this.client = DynamoDBDocumentClient.from(dynamoClient);
            this.ownedClient = true;
        }

        // Create service with either shared or owned client
        this.service = getElectroDbService(this.client, this.tableName);
    }

    /**
     * Initialize the domain. If shared initialization is provided (from DynamoDBStore),
     * use that. Otherwise, perform our own initialization.
     */
    async init(): Promise<void> {
        if (this.getSharedInit) {
            // Use shared initialization from DynamoDBStore
            const sharedInit = this.getSharedInit();
            if (sharedInit) {
                try {
                    await sharedInit;
                } catch (error) {
                    throw new MastraError(
                        {
                            id: 'STORAGE_DYNAMODB_DOMAIN_SHARED_INIT_FAILED',
                            domain: ErrorDomain.STORAGE,
                            category: ErrorCategory.THIRD_PARTY,
                        },
                        error,
                    );
                }
                return;
            }
        }

        // Standalone mode - perform our own initialization
        if (!this.hasInitialized) {
            this.hasInitialized = this._performInitializationAndStore();
        }

        try {
            await this.hasInitialized;
        } catch (error) {
            throw new MastraError(
                {
                    id: 'STORAGE_DYNAMODB_DOMAIN_INIT_FAILED',
                    domain: ErrorDomain.STORAGE,
                    category: ErrorCategory.THIRD_PARTY,
                    details: { tableName: this.tableName || '' },
                },
                error,
            );
        }
    }

    private _performInitializationAndStore(): Promise<boolean> {
        if (!this.tableName) {
            throw new MastraError({
                id: 'STORAGE_DYNAMODB_DOMAIN_NO_TABLE_NAME',
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.SYSTEM,
                text: 'Table name is required for standalone initialization',
            });
        }

        return this.validateTableExists()
            .then(exists => {
                if (!exists) {
                    throw new Error(
                        `Table ${this.tableName} does not exist or is not accessible. Ensure it's created via CDK/CloudFormation before using this store.`,
                    );
                }
                return true;
            })
            .catch(error => {
                // Reset on failure so next call to init() will retry
                this.hasInitialized = null;
                throw error;
            });
    }

    private async validateTableExists(): Promise<boolean> {
        try {
            const command = new DescribeTableCommand({ TableName: this.tableName });
            const rawClient = this.client.send.bind(this.client);
            await rawClient(command);
            return true;
        } catch (error: any) {
            if (error.name === 'ResourceNotFoundException') {
                return false;
            }
            // Re-throw other errors
            throw new MastraError(
                {
                    id: 'STORAGE_DYNAMODB_DOMAIN_TABLE_VALIDATION_FAILED',
                    domain: ErrorDomain.STORAGE,
                    category: ErrorCategory.THIRD_PARTY,
                    details: { tableName: this.tableName },
                },
                error,
            );
        }
    }

    /**
     * Clear all data for a specific entity type
     */
    protected async clearEntityData(entityName: string): Promise<void> {
        if (!this.service.entities[entityName]) {
            throw new MastraError({
                id: 'STORAGE_DYNAMODB_CLEAR_ENTITY_INVALID',
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                text: `No entity defined for entity name: ${entityName}`,
            });
        }

        try {
            // Scan all items for this entity
            const result = await this.service.entities[entityName].scan.go({ pages: 'all' });

            if (!result.data.length) {
                return;
            }

            // Batch delete in chunks of 25 (DynamoDB limit)
            const batchSize = 25;
            for (let i = 0; i < result.data.length; i += batchSize) {
                const batch = result.data.slice(i, i + batchSize);
                await this.service.entities[entityName].delete(batch).go();
            }
        } catch (error) {
            throw new MastraError(
                {
                    id: 'STORAGE_DYNAMODB_CLEAR_ENTITY_FAILED',
                    domain: ErrorDomain.STORAGE,
                    category: ErrorCategory.THIRD_PARTY,
                    details: { entityName },
                },
                error,
            );
        }
    }

    /**
     * Clean up owned resources (only if standalone)
     */
    async close(): Promise<void> {
        if (this.ownedClient) {
            await this.client.destroy();
        }
    }

    /**
     * Returns true if this domain owns its client (standalone mode)
     */
    protected get isStandalone(): boolean {
        return this.ownedClient;
    }
}

