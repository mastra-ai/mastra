import { DeleteQueryNode } from '../../operation-node/delete-query-node.js';
import { OperationNodeTransformer } from '../../operation-node/operation-node-transformer.js';
import { SelectQueryNode } from '../../operation-node/select-query-node.js';
import { UpdateQueryNode } from '../../operation-node/update-query-node.js';
import { QueryId } from '../../util/query-id.js';
export declare class DeduplicateJoinsTransformer extends OperationNodeTransformer {
    #private;
    protected transformSelectQuery(node: SelectQueryNode, queryId: QueryId): SelectQueryNode;
    protected transformUpdateQuery(node: UpdateQueryNode, queryId: QueryId): UpdateQueryNode;
    protected transformDeleteQuery(node: DeleteQueryNode, queryId: QueryId): DeleteQueryNode;
}
