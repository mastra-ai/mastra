import { Data, Schema } from "./arrow";
import { MergeResult, NativeMergeInsertBuilder } from "./native";
/** A builder used to create and run a merge insert operation */
export declare class MergeInsertBuilder {
    #private;
    /** Construct a MergeInsertBuilder. __Internal use only.__ */
    constructor(native: NativeMergeInsertBuilder, schema: Schema | Promise<Schema>);
    /**
     * Rows that exist in both the source table (new data) and
     * the target table (old data) will be updated, replacing
     * the old row with the corresponding matching row.
     *
     * If there are multiple matches then the behavior is undefined.
     * Currently this causes multiple copies of the row to be created
     * but that behavior is subject to change.
     *
     * An optional condition may be specified.  If it is, then only
     * matched rows that satisfy the condtion will be updated.  Any
     * rows that do not satisfy the condition will be left as they
     * are.  Failing to satisfy the condition does not cause a
     * "matched row" to become a "not matched" row.
     *
     * The condition should be an SQL string.  Use the prefix
     * target. to refer to rows in the target table (old data)
     * and the prefix source. to refer to rows in the source
     * table (new data).
     *
     * For example, "target.last_update < source.last_update"
     */
    whenMatchedUpdateAll(options?: {
        where: string;
    }): MergeInsertBuilder;
    /**
     * Rows that exist only in the source table (new data) should
     * be inserted into the target table.
     */
    whenNotMatchedInsertAll(): MergeInsertBuilder;
    /**
     * Rows that exist only in the target table (old data) will be
     * deleted.  An optional condition can be provided to limit what
     * data is deleted.
     *
     * @param options.where - An optional condition to limit what data is deleted
     */
    whenNotMatchedBySourceDelete(options?: {
        where: string;
    }): MergeInsertBuilder;
    /**
     * Controls whether to use indexes for the merge operation.
     *
     * When set to `true` (the default), the operation will use an index if available
     * on the join key for improved performance. When set to `false`, it forces a full
     * table scan even if an index exists. This can be useful for benchmarking or when
     * the query optimizer chooses a suboptimal path.
     *
     * @param useIndex - Whether to use indices for the merge operation. Defaults to `true`.
     */
    useIndex(useIndex: boolean): MergeInsertBuilder;
    /**
     * Executes the merge insert operation
     *
     * @returns {Promise<MergeResult>} the merge result
     */
    execute(data: Data, execOptions?: Partial<WriteExecutionOptions>): Promise<MergeResult>;
}
export interface WriteExecutionOptions {
    /**
     * Maximum time to run the operation before cancelling it.
     *
     * By default, there is a 30-second timeout that is only enforced after the
     * first attempt. This is to prevent spending too long retrying to resolve
     * conflicts. For example, if a write attempt takes 20 seconds and fails,
     * the second attempt will be cancelled after 10 seconds, hitting the
     * 30-second timeout. However, a write that takes one hour and succeeds on the
     * first attempt will not be cancelled.
     *
     * When this is set, the timeout is enforced on all attempts, including the first.
     */
    timeoutMs?: number;
}
