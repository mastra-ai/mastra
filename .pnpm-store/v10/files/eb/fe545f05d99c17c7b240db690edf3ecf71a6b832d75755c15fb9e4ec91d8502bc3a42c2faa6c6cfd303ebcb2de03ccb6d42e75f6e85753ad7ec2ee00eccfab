import { BinaryOperationNode } from '../../operation-node/binary-operation-node.js';
import { OperatorNode } from '../../operation-node/operator-node.js';
import { PrimitiveValueListNode } from '../../operation-node/primitive-value-list-node.js';
import { ValueListNode } from '../../operation-node/value-list-node.js';
export interface HandleEmptyInListsOptions {
    /**
     * The strategy to use when handling `in ()` and `not in ()`.
     *
     * See {@link HandleEmptyInListsPlugin} for examples.
     */
    strategy: EmptyInListsStrategy;
}
export type EmptyInListNode = BinaryOperationNode & {
    operator: OperatorNode & {
        operator: 'in' | 'not in';
    };
    rightOperand: (ValueListNode | PrimitiveValueListNode) & {
        values: Readonly<[]>;
    };
};
export type EmptyInListsStrategy = (node: EmptyInListNode) => BinaryOperationNode;
/**
 * Replaces the `in`/`not in` expression with a noncontingent expression (always true or always
 * false) depending on the original operator.
 *
 * This is how Knex.js, PrismaORM, Laravel, and SQLAlchemy handle `in ()` and `not in ()`.
 *
 * See {@link pushValueIntoList} for an alternative strategy.
 */
export declare function replaceWithNoncontingentExpression(node: EmptyInListNode): BinaryOperationNode;
/**
 * When `in`, pushes a `null` value into the list resulting in `in (null)`. This
 * is how TypeORM and Sequelize handle `in ()`. `in (null)` is logically the equivalent
 * of `= null`, which returns `null`, which is a falsy expression in most SQL databases.
 * We recommend NOT using this strategy if you plan to use `in` in `select`, `returning`,
 * or `output` clauses, as the return type differs from the `SqlBool` default type.
 *
 * When `not in`, casts the left operand as `char` and pushes a literal value into
 * the list resulting in `cast({{lhs}} as char) not in ({{VALUE}})`. Casting
 * is required to avoid database errors with non-string columns.
 *
 * See {@link replaceWithNoncontingentExpression} for an alternative strategy.
 */
export declare function pushValueIntoList(uniqueNotInLiteral: '__kysely_no_values_were_provided__' | (string & {})): EmptyInListsStrategy;
