/// <reference types="./alter-column-builder.d.ts" />
import { AlterColumnNode } from '../operation-node/alter-column-node.js';
import { parseDataTypeExpression, } from '../parser/data-type-parser.js';
import { parseDefaultValueExpression, } from '../parser/default-value-parser.js';
export class AlterColumnBuilder {
    #column;
    constructor(column) {
        this.#column = column;
    }
    setDataType(dataType) {
        return new AlteredColumnBuilder(AlterColumnNode.create(this.#column, 'dataType', parseDataTypeExpression(dataType)));
    }
    setDefault(value) {
        return new AlteredColumnBuilder(AlterColumnNode.create(this.#column, 'setDefault', parseDefaultValueExpression(value)));
    }
    dropDefault() {
        return new AlteredColumnBuilder(AlterColumnNode.create(this.#column, 'dropDefault', true));
    }
    setNotNull() {
        return new AlteredColumnBuilder(AlterColumnNode.create(this.#column, 'setNotNull', true));
    }
    dropNotNull() {
        return new AlteredColumnBuilder(AlterColumnNode.create(this.#column, 'dropNotNull', true));
    }
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call(func) {
        return func(this);
    }
}
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
export class AlteredColumnBuilder {
    #alterColumnNode;
    constructor(alterColumnNode) {
        this.#alterColumnNode = alterColumnNode;
    }
    toOperationNode() {
        return this.#alterColumnNode;
    }
}
