import { QueryNode } from '../operation-node/query-node.js';
export type NoResultErrorConstructor = new (node: QueryNode) => Error;
export declare class NoResultError extends Error {
    /**
     * The operation node tree of the query that was executed.
     */
    readonly node: QueryNode;
    constructor(node: QueryNode);
}
export declare function isNoResultErrorConstructor(fn: NoResultErrorConstructor | ((node: QueryNode) => Error)): fn is NoResultErrorConstructor;
