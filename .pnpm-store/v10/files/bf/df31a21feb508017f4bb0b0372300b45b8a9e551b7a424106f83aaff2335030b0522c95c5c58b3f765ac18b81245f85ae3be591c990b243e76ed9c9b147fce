"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceWithNoncontingentExpression = replaceWithNoncontingentExpression;
exports.pushValueIntoList = pushValueIntoList;
const binary_operation_node_js_1 = require("../../operation-node/binary-operation-node.js");
const cast_node_js_1 = require("../../operation-node/cast-node.js");
const data_type_node_js_1 = require("../../operation-node/data-type-node.js");
const operator_node_js_1 = require("../../operation-node/operator-node.js");
const value_list_node_js_1 = require("../../operation-node/value-list-node.js");
const value_node_js_1 = require("../../operation-node/value-node.js");
const object_utils_js_1 = require("../../util/object-utils.js");
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
function replaceWithNoncontingentExpression(node) {
    const _one = (one ||= value_node_js_1.ValueNode.createImmediate(1));
    const _eq = (eq ||= operator_node_js_1.OperatorNode.create('='));
    if (node.operator.operator === 'in') {
        return (contradiction ||= binary_operation_node_js_1.BinaryOperationNode.create(_one, _eq, value_node_js_1.ValueNode.createImmediate(0)));
    }
    return (tautology ||= binary_operation_node_js_1.BinaryOperationNode.create(_one, _eq, _one));
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
function pushValueIntoList(uniqueNotInLiteral) {
    return function pushValueIntoList(node) {
        if (node.operator.operator === 'in') {
            return (0, object_utils_js_1.freeze)({
                ...node,
                rightOperand: (listNull ||= value_list_node_js_1.ValueListNode.create([
                    value_node_js_1.ValueNode.createImmediate(null),
                ])),
            });
        }
        return (0, object_utils_js_1.freeze)({
            ...node,
            leftOperand: cast_node_js_1.CastNode.create(node.leftOperand, (char ||= data_type_node_js_1.DataTypeNode.create('char'))),
            rightOperand: (listVal ||= value_list_node_js_1.ValueListNode.create([
                value_node_js_1.ValueNode.createImmediate(uniqueNotInLiteral),
            ])),
        });
    };
}
