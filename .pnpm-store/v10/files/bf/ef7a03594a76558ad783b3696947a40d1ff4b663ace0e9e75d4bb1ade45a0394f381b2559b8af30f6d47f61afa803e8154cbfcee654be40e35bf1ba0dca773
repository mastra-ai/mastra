export declare class UpdateResult {
    /**
     * The number of rows the update query updated (even if not changed).
     */
    readonly numUpdatedRows: bigint;
    /**
     * The number of rows the update query changed.
     *
     * This is **optional** and only supported in dialects such as MySQL.
     * You would probably use {@link numUpdatedRows} in most cases.
     */
    readonly numChangedRows?: bigint;
    constructor(numUpdatedRows: bigint, numChangedRows: bigint | undefined);
}
