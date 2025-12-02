/// <reference types="./handle-empty-in-lists.d.ts" />
import { BinaryOperationNode } from '../../operation-node/binary-operation-node.js';
import { CastNode } from '../../operation-node/cast-node.js';
import { DataTypeNode } from '../../operation-node/data-type-node.js';
import { OperatorNode } from '../../operation-node/operator-node.js';
import { ValueListNode } from '../../operation-node/value-list-node.js';
import { ValueNode } from '../../operation-node/value-node.js';
import { freeze } from '../../util/object-utils.js';
let contradiction;
let eq;
let one;
let tautology;
/**
 * Replaces the `in`/`not in` expression with a noncontingent expression (always true or always
 * false) depending on the original operator.
 *
 * This is how Knex.js, PrismaORM, Laravel, and SQLAlchemy handle `in ()` and `not in ()`.
 *
 * See {@link pushValueIntoList} for an alternative strategy.
 */
export function replaceWithNoncontingentExpression(node) {
    const _one = (one ||= ValueNode.createImmediate(1));
    const _eq = (eq ||= OperatorNode.create('='));
    if (node.operator.operator === 'in') {
        return (contradiction ||= BinaryOperationNode.create(_one, _eq, ValueNode.createImmediate(0)));
    }
    return (tautology ||= BinaryOperationNode.create(_one, _eq, _one));
}
let char;
let listNull;
let listVal;
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
export function pushValueIntoList(uniqueNotInLiteral) {
    return function pushValueIntoList(node) {
        if (node.operator.operator === 'in') {
            return freeze({
                ...node,
                rightOperand: (listNull ||= ValueListNode.create([
                    ValueNode.createImmediate(null),
                ])),
            });
        }
        return freeze({
            ...node,
            leftOperand: CastNode.create(node.leftOperand, (char ||= DataTypeNode.create('char'))),
            rightOperand: (listVal ||= ValueListNode.create([
                ValueNode.createImmediate(uniqueNotInLiteral),
            ])),
        });
    };
}
