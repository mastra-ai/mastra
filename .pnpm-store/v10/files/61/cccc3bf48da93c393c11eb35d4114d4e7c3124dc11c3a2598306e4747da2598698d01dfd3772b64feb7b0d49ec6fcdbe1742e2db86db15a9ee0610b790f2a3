import { ComparisonOperatorExpression, OperandValueExpressionOrList } from '../parser/binary-operation-parser.js';
import { ReferenceExpression } from '../parser/reference-parser.js';
export interface HavingInterface<DB, TB extends keyof DB> {
    /**
     * Just like {@link WhereInterface.where | where} but adds a `having` statement
     * instead of a `where` statement.
     */
    having<RE extends ReferenceExpression<DB, TB>, VE extends OperandValueExpressionOrList<DB, TB, RE>>(lhs: RE, op: ComparisonOperatorExpression, rhs: VE): HavingInterface<DB, TB>;
    having<E>(expression: E): HavingInterface<DB, TB>;
    /**
     * Just like {@link WhereInterface.whereRef | whereRef} but adds a `having` statement
     * instead of a `where` statement.
     */
    havingRef<LRE extends ReferenceExpression<DB, TB>, RRE extends ReferenceExpression<DB, TB>>(lhs: LRE, op: ComparisonOperatorExpression, rhs: RRE): HavingInterface<DB, TB>;
}
