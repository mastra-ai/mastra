/**
 * Adds one or more items to a Cuckoo Filter only if they do not exist yet, creating the filter if needed
 * @param parser - The command parser
 * @param key - The name of the Cuckoo filter
 * @param items - One or more items to add to the filter
 * @param options - Optional parameters for filter creation
 * @param options.CAPACITY - The number of entries intended to be added to the filter
 * @param options.NOCREATE - If true, prevents automatic filter creation
 */
declare const _default: {
    readonly IS_READ_ONLY: false;
    readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, items: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./INSERT").CfInsertOptions | undefined) => void;
    readonly transformReply: {
        2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
        3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
    };
};
export default _default;
//# sourceMappingURL=INSERTNX.d.ts.map