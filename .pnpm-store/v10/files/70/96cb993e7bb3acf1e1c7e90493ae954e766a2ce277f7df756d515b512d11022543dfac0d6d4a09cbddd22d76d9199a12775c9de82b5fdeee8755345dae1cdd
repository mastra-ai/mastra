import { AggregateFunctionNode } from '../../operation-node/aggregate-function-node.js';
import { FunctionNode } from '../../operation-node/function-node.js';
import { OperationNodeTransformer } from '../../operation-node/operation-node-transformer.js';
import { OperationNode } from '../../operation-node/operation-node.js';
import { ReferencesNode } from '../../operation-node/references-node.js';
import { SchemableIdentifierNode } from '../../operation-node/schemable-identifier-node.js';
import { QueryId } from '../../util/query-id.js';
export declare class WithSchemaTransformer extends OperationNodeTransformer {
    #private;
    constructor(schema: string);
    protected transformNodeImpl<T extends OperationNode>(node: T, queryId: QueryId): T;
    protected transformSchemableIdentifier(node: SchemableIdentifierNode, queryId: QueryId): SchemableIdentifierNode;
    protected transformReferences(node: ReferencesNode, queryId: QueryId): ReferencesNode;
    protected transformAggregateFunction(node: AggregateFunctionNode, queryId: QueryId): AggregateFunctionNode;
    protected transformFunction(node: FunctionNode, queryId: QueryId): FunctionNode;
}
