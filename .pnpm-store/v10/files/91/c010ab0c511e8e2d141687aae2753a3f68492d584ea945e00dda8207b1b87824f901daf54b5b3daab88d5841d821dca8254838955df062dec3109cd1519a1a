import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument } from '@redis/client/dist/lib/RESP/types';
import { RedisVariadicArgument } from '@redis/client/dist/lib/commands/generic-transformers';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Checks if multiple items exist in a Bloom Filter in a single call
     * @param parser - The command parser
     * @param key - The name of the Bloom filter
     * @param items - One or more items to check for existence
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, items: RedisVariadicArgument) => void;
    readonly transformReply: {
        2: (reply: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<0 | 1>>) => boolean[];
        3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BooleanReply<boolean>>;
    };
};
export default _default;
//# sourceMappingURL=MEXISTS.d.ts.map