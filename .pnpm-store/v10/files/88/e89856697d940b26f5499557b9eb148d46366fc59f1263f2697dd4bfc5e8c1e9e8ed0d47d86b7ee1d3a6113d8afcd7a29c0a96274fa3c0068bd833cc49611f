import { Connection } from "./connection.js";
import { PermutationBuilder as NativePermutationBuilder, ShuffleOptions, SplitCalculatedOptions, SplitHashOptions, SplitRandomOptions, SplitSequentialOptions } from "./native.js";
import { Table } from "./table";
/**
 * A PermutationBuilder for creating data permutations with splits, shuffling, and filtering.
 *
 * This class provides a TypeScript wrapper around the native Rust PermutationBuilder,
 * offering methods to configure data splits, shuffling, and filtering before executing
 * the permutation to create a new table.
 */
export declare class PermutationBuilder {
    private inner;
    /**
     * @hidden
     */
    constructor(inner: NativePermutationBuilder);
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
    persist(connection: Connection, tableName: string): PermutationBuilder;
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
    splitRandom(options: SplitRandomOptions): PermutationBuilder;
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
    splitHash(options: SplitHashOptions): PermutationBuilder;
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
    splitSequential(options: SplitSequentialOptions): PermutationBuilder;
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
    splitCalculated(options: SplitCalculatedOptions): PermutationBuilder;
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
    shuffle(options: ShuffleOptions): PermutationBuilder;
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
    filter(filter: string): PermutationBuilder;
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
    execute(): Promise<Table>;
}
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
export declare function permutationBuilder(table: Table): PermutationBuilder;
