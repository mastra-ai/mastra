"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermutationBuilder = void 0;
exports.permutationBuilder = permutationBuilder;
const native_js_1 = require("./native.js");
const table_1 = require("./table");
/**
 * A PermutationBuilder for creating data permutations with splits, shuffling, and filtering.
 *
 * This class provides a TypeScript wrapper around the native Rust PermutationBuilder,
 * offering methods to configure data splits, shuffling, and filtering before executing
 * the permutation to create a new table.
 */
class PermutationBuilder {
    inner;
    /**
     * @hidden
     */
    constructor(inner) {
        this.inner = inner;
    }
    /**
     * Configure the permutation to be persisted.
     *
     * @param connection - The connection to persist the permutation to
     * @param tableName - The name of the table to create
     * @returns A new PermutationBuilder instance
     * @example
     * ```ts
     * builder.persist(connection, "permutation_table");
     * ```
     */
    persist(connection, tableName) {
        const localConnection = connection;
        const newInner = this.inner.persist(localConnection.inner, tableName);
        return new PermutationBuilder(newInner);
    }
    /**
     * Configure random splits for the permutation.
     *
     * @param options - Configuration for random splitting
     * @returns A new PermutationBuilder instance
     * @example
     * ```ts
     * // Split by ratios
     * builder.splitRandom({ ratios: [0.7, 0.3], seed: 42 });
     *
     * // Split by counts
     * builder.splitRandom({ counts: [1000, 500], seed: 42 });
     *
     * // Split with fixed size
     * builder.splitRandom({ fixed: 100, seed: 42 });
     * ```
     */
    splitRandom(options) {
        const newInner = this.inner.splitRandom(options);
        return new PermutationBuilder(newInner);
    }
    /**
     * Configure hash-based splits for the permutation.
     *
     * @param options - Configuration for hash-based splitting
     * @returns A new PermutationBuilder instance
     * @example
     * ```ts
     * builder.splitHash({
     *   columns: ["user_id"],
     *   splitWeights: [70, 30],
     *   discardWeight: 0
     * });
     * ```
     */
    splitHash(options) {
        const newInner = this.inner.splitHash(options);
        return new PermutationBuilder(newInner);
    }
    /**
     * Configure sequential splits for the permutation.
     *
     * @param options - Configuration for sequential splitting
     * @returns A new PermutationBuilder instance
     * @example
     * ```ts
     * // Split by ratios
     * builder.splitSequential({ ratios: [0.8, 0.2] });
     *
     * // Split by counts
     * builder.splitSequential({ counts: [800, 200] });
     *
     * // Split with fixed size
     * builder.splitSequential({ fixed: 1000 });
     * ```
     */
    splitSequential(options) {
        const newInner = this.inner.splitSequential(options);
        return new PermutationBuilder(newInner);
    }
    /**
     * Configure calculated splits for the permutation.
     *
     * @param options - Configuration for calculated splitting
     * @returns A new PermutationBuilder instance
     * @example
     * ```ts
     * builder.splitCalculated("user_id % 3");
     * ```
     */
    splitCalculated(options) {
        const newInner = this.inner.splitCalculated(options);
        return new PermutationBuilder(newInner);
    }
    /**
     * Configure shuffling for the permutation.
     *
     * @param options - Configuration for shuffling
     * @returns A new PermutationBuilder instance
     * @example
     * ```ts
     * // Basic shuffle
     * builder.shuffle({ seed: 42 });
     *
     * // Shuffle with clump size
     * builder.shuffle({ seed: 42, clumpSize: 10 });
     * ```
     */
    shuffle(options) {
        const newInner = this.inner.shuffle(options);
        return new PermutationBuilder(newInner);
    }
    /**
     * Configure filtering for the permutation.
     *
     * @param filter - SQL filter expression
     * @returns A new PermutationBuilder instance
     * @example
     * ```ts
     * builder.filter("age > 18 AND status = 'active'");
     * ```
     */
    filter(filter) {
        const newInner = this.inner.filter(filter);
        return new PermutationBuilder(newInner);
    }
    /**
     * Execute the permutation and create the destination table.
     *
     * @returns A Promise that resolves to the new Table instance
     * @example
     * ```ts
     * const permutationTable = await builder.execute();
     * console.log(`Created table: ${permutationTable.name}`);
     * ```
     */
    async execute() {
        const nativeTable = await this.inner.execute();
        return new table_1.LocalTable(nativeTable);
    }
}
exports.PermutationBuilder = PermutationBuilder;
/**
 * Create a permutation builder for the given table.
 *
 * @param table - The source table to create a permutation from
 * @returns A PermutationBuilder instance
 * @example
 * ```ts
 * const builder = permutationBuilder(sourceTable, "training_data")
 *   .splitRandom({ ratios: [0.8, 0.2], seed: 42 })
 *   .shuffle({ seed: 123 });
 *
 * const trainingTable = await builder.execute();
 * ```
 */
function permutationBuilder(table) {
    // Extract the inner native table from the TypeScript wrapper
    const localTable = table;
    // Access inner through type assertion since it's private
    const nativeBuilder = (0, native_js_1.permutationBuilder)(
    // biome-ignore lint/suspicious/noExplicitAny: need access to private variable
    localTable.inner);
    return new PermutationBuilder(nativeBuilder);
}
