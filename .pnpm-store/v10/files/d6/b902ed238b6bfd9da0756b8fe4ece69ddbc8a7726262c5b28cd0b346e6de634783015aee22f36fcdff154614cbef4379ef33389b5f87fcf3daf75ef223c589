"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlteredColumnBuilder = exports.AlterColumnBuilder = void 0;
const alter_column_node_js_1 = require("../operation-node/alter-column-node.js");
const data_type_parser_js_1 = require("../parser/data-type-parser.js");
const default_value_parser_js_1 = require("../parser/default-value-parser.js");
class AlterColumnBuilder {
    #column;
    constructor(column) {
        this.#column = column;
    }
    setDataType(dataType) {
        return new AlteredColumnBuilder(alter_column_node_js_1.AlterColumnNode.create(this.#column, 'dataType', (0, data_type_parser_js_1.parseDataTypeExpression)(dataType)));
    }
    setDefault(value) {
        return new AlteredColumnBuilder(alter_column_node_js_1.AlterColumnNode.create(this.#column, 'setDefault', (0, default_value_parser_js_1.parseDefaultValueExpression)(value)));
    }
    dropDefault() {
        return new AlteredColumnBuilder(alter_column_node_js_1.AlterColumnNode.create(this.#column, 'dropDefault', true));
    }
    setNotNull() {
        return new AlteredColumnBuilder(alter_column_node_js_1.AlterColumnNode.create(this.#column, 'setNotNull', true));
    }
    dropNotNull() {
        return new AlteredColumnBuilder(alter_column_node_js_1.AlterColumnNode.create(this.#column, 'dropNotNull', true));
    }
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call(func) {
        return func(this);
    }
}
exports.AlterColumnBuilder = AlterColumnBuilder;
/**
 * Allows us to force consumers to do exactly one alteration to a column.
 *
 * One cannot do no alterations:
 *
 * ```ts
 * await db.schema
 *   .alterTable('person')
 * //  .execute() // Property 'execute' does not exist on type 'AlteredColumnBuilder'.
 * ```
 *
 * ```ts
 * await db.schema
 *   .alterTable('person')
 * //  .alterColumn('age', (ac) => ac) // Type 'AlterColumnBuilder' is not assignable to type 'AlteredColumnBuilder'.
 * //  .execute()
 * ```
 *
 * One cannot do multiple alterations:
 *
 * ```ts
 * await db.schema
 *   .alterTable('person')
 * //  .alterColumn('age', (ac) => ac.dropNotNull().setNotNull()) // Property 'setNotNull' does not exist on type 'AlteredColumnBuilder'.
 * //  .execute()
 * ```
 *
 * Which would now throw a compilation error, instead of a runtime error.
 */
class AlteredColumnBuilder {
    #alterColumnNode;
    constructor(alterColumnNode) {
        this.#alterColumnNode = alterColumnNode;
    }
    toOperationNode() {
        return this.#alterColumnNode;
    }
}
exports.AlteredColumnBuilder = AlteredColumnBuilder;
