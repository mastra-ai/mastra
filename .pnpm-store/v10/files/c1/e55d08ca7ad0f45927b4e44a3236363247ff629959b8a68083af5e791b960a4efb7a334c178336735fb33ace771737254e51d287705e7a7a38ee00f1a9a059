/// <reference types="./query-executor-base.d.ts" />
import { freeze } from '../util/object-utils.js';
import { provideControlledConnection } from '../util/provide-controlled-connection.js';
import { logOnce } from '../util/log-once.js';
const NO_PLUGINS = freeze([]);
export class QueryExecutorBase {
    #plugins;
    constructor(plugins = NO_PLUGINS) {
        this.#plugins = plugins;
    }
    get plugins() {
        return this.#plugins;
    }
    transformQuery(node, queryId) {
        for (const plugin of this.#plugins) {
            const transformedNode = plugin.transformQuery({ node, queryId });
            // We need to do a runtime check here. There is no good way
            // to write types that enforce this constraint.
            if (transformedNode.kind === node.kind) {
                node = transformedNode;
            }
            else {
                throw new Error([
                    `KyselyPlugin.transformQuery must return a node`,
                    `of the same kind that was given to it.`,
                    `The plugin was given a ${node.kind}`,
                    `but it returned a ${transformedNode.kind}`,
                ].join(' '));
            }
        }
        return node;
    }
    async executeQuery(compiledQuery) {
        return await this.provideConnection(async (connection) => {
            const result = await connection.executeQuery(compiledQuery);
            if ('numUpdatedOrDeletedRows' in result) {
                logOnce('kysely:warning: outdated driver/plugin detected! `QueryResult.numUpdatedOrDeletedRows` has been replaced with `QueryResult.numAffectedRows`.');
            }
            return await this.#transformResult(result, compiledQuery.queryId);
        });
    }
    async *stream(compiledQuery, chunkSize) {
        const { connection, release } = await provideControlledConnection(this);
        try {
            for await (const result of connection.streamQuery(compiledQuery, chunkSize)) {
                yield await this.#transformResult(result, compiledQuery.queryId);
            }
        }
        finally {
            release();
        }
    }
    async #transformResult(result, queryId) {
        for (const plugin of this.#plugins) {
            result = await plugin.transformResult({ result, queryId });
        }
        return result;
    }
}
