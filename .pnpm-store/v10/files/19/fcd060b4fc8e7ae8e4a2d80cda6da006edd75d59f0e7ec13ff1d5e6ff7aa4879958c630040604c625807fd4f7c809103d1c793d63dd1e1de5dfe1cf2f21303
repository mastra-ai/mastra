import { JoinNode } from '../operation-node/join-node.js';
import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { ComparisonOperatorExpression, OperandValueExpressionOrList } from '../parser/binary-operation-parser.js';
import { ExpressionOrFactory } from '../parser/expression-parser.js';
import { ReferenceExpression } from '../parser/reference-parser.js';
import { SqlBool } from '../util/type-utils.js';
export declare class JoinBuilder<DB, TB extends keyof DB> implements OperationNodeSource {
    #private;
    constructor(props: JoinBuilderProps);
    /**
     * Just like {@link WhereInterface.where} but adds an item to the join's
     * `on` clause instead.
     *
     * See {@link WhereInterface.where} for documentation and examples.
     */
    on<RE extends ReferenceExpression<DB, TB>>(lhs: RE, op: ComparisonOperatorExpression, rhs: OperandValueExpressionOrList<DB, TB, RE>): JoinBuilder<DB, TB>;
    on(expression: ExpressionOrFactory<DB, TB, SqlBool>): JoinBuilder<DB, TB>;
    /**
     * Just like {@link WhereInterface.whereRef} but adds an item to the join's
     * `on` clause instead.
     *
     * See {@link WhereInterface.whereRef} for documentation and examples.
     */
    onRef(lhs: ReferenceExpression<DB, TB>, op: ComparisonOperatorExpression, rhs: ReferenceExpression<DB, TB>): JoinBuilder<DB, TB>;
    /**
     * Adds `on true`.
     */
    onTrue(): JoinBuilder<DB, TB>;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
    toOperationNode(): JoinNode;
}
export interface JoinBuilderProps {
    readonly joinNode: JoinNode;
}
