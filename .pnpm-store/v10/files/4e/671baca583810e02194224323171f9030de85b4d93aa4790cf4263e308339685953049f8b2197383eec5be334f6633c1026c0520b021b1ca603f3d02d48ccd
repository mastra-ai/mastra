import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument } from '@redis/client/dist/lib/RESP/types';
import { RedisVariadicArgument } from '@redis/client/dist/lib/commands/generic-transformers';
export interface CfInsertOptions {
    CAPACITY?: number;
    NOCREATE?: boolean;
}
export declare function parseCfInsertArguments(parser: CommandParser, key: RedisArgument, items: RedisVariadicArgument, options?: CfInsertOptions): void;
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Adds one or more items to a Cuckoo Filter, creating it if it does not exist
     * @param parser - The command parser
     * @param key - The name of the Cuckoo filter
     * @param items - One or more items to add to the filter
     * @param options - Optional parameters for filter creation
     * @param options.CAPACITY - The number of entries intended to be added to the filter
     * @param options.NOCREATE - If true, prevents automatic filter creation
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, items: RedisVariadicArgument, options?: CfInsertOptions | undefined) => void;
    readonly transformReply: {
        2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
        3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
    };
};
export default _default;
//# sourceMappingURL=INSERT.d.ts.map