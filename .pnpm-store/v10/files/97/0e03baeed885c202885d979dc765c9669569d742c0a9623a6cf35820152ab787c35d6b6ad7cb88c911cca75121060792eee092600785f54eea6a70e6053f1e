"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateResult = void 0;
class UpdateResult {
    /**
     * The number of rows the update query updated (even if not changed).
     */
    numUpdatedRows;
    /**
     * The number of rows the update query changed.
     *
     * This is **optional** and only supported in dialects such as MySQL.
     * You would probably use {@link numUpdatedRows} in most cases.
     */
    numChangedRows;
    constructor(numUpdatedRows, numChangedRows) {
        this.numUpdatedRows = numUpdatedRows;
        this.numChangedRows = numChangedRows;
    }
}
exports.UpdateResult = UpdateResult;
