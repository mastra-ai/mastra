import { AliasNode } from '../operation-node/alias-node.js';
import { OperationNodeSource } from '../operation-node/operation-node-source.js';
export declare class DynamicTableBuilder<T extends string> {
    #private;
    get table(): T;
    constructor(table: T);
    as<A extends string>(alias: A): AliasedDynamicTableBuilder<T, A>;
}
export declare class AliasedDynamicTableBuilder<T extends string, A extends string> implements OperationNodeSource {
    #private;
    get table(): T;
    get alias(): A;
    constructor(table: T, alias: A);
    toOperationNode(): AliasNode;
}
export declare function isAliasedDynamicTableBuilder(obj: unknown): obj is AliasedDynamicTableBuilder<any, any>;
