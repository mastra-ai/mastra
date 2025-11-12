import { MongoDBConnector } from '../connectors/MongoDBConnector';
import type { MongoDBConfig } from '../types';
import { MongoDBOperations } from './operations';

/**
 * Configuration for MongoDB domain classes supporting both shared and standalone usage
 */
export type MongoDBDomainConfig =
    | {
        operations: MongoDBOperations;
        config?: never;
    }
    | {
        operations?: never;
        config: MongoDBConfig;
    };

/**
 * Base class for MongoDB storage domains that supports both:
 * 1. Shared connector usage (via MongoDBStore)
 * 2. Standalone usage (creates own connector)
 */
export class MongoDBDomainBase {
    db: MongoDBOperations;
    private ownedConnector?: MongoDBConnector;

    constructor(opts: MongoDBDomainConfig) {
        if (opts.operations) {
            // Shared connector usage (via MongoDBStore)
            this.db = opts.operations;
        } else {
            // Standalone usage - create our own connector
            const connector = this.loadConnector(opts.config);
            this.ownedConnector = connector;
            this.db = new MongoDBOperations({ connector });
        }
    }

    private loadConnector(config: MongoDBConfig): MongoDBConnector {
        if ('connectorHandler' in config) {
            return MongoDBConnector.fromConnectionHandler(config.connectorHandler);
        }
        return MongoDBConnector.fromDatabaseConfig({
            id: config.id,
            options: config.options,
            url: config.url,
            dbName: config.dbName,
        });
    }

    /**
     * Clean up owned resources.
     * Only closes the connector if this domain instance created it (standalone mode).
     */
    async close(): Promise<void> {
        if (this.ownedConnector) {
            await this.ownedConnector.close();
        }
    }

    /**
     * Returns true if this domain owns its connector (standalone mode)
     */
    protected get isStandalone(): boolean {
        return !!this.ownedConnector;
    }
}

