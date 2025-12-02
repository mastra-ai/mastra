"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MergeInsertBuilder = void 0;
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors
const arrow_1 = require("./arrow");
/** A builder used to create and run a merge insert operation */
class MergeInsertBuilder {
    #native;
    #schema;
    /** Construct a MergeInsertBuilder. __Internal use only.__ */
    constructor(native, schema) {
        this.#native = native;
        this.#schema = schema;
    }
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
    whenMatchedUpdateAll(options) {
        return new MergeInsertBuilder(this.#native.whenMatchedUpdateAll(options?.where), this.#schema);
    }
    /**
     * Rows that exist only in the source table (new data) should
     * be inserted into the target table.
     */
    whenNotMatchedInsertAll() {
        return new MergeInsertBuilder(this.#native.whenNotMatchedInsertAll(), this.#schema);
    }
    /**
     * Rows that exist only in the target table (old data) will be
     * deleted.  An optional condition can be provided to limit what
     * data is deleted.
     *
     * @param options.where - An optional condition to limit what data is deleted
     */
    whenNotMatchedBySourceDelete(options) {
        return new MergeInsertBuilder(this.#native.whenNotMatchedBySourceDelete(options?.where), this.#schema);
    }
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
    useIndex(useIndex) {
        return new MergeInsertBuilder(this.#native.useIndex(useIndex), this.#schema);
    }
    /**
     * Executes the merge insert operation
     *
     * @returns {Promise<MergeResult>} the merge result
     */
    async execute(data, execOptions) {
        let schema;
        if (this.#schema instanceof Promise) {
            schema = await this.#schema;
            this.#schema = schema; // In case of future calls
        }
        else {
            schema = this.#schema;
        }
        if (execOptions?.timeoutMs !== undefined) {
            this.#native.setTimeout(execOptions.timeoutMs);
        }
        const buffer = await (0, arrow_1.fromDataToBuffer)(data, undefined, schema);
        return await this.#native.execute(buffer);
    }
}
exports.MergeInsertBuilder = MergeInsertBuilder;
