import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument } from '@redis/client/dist/lib/RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Multiplies a numeric value stored in a JSON document by a given number.
     * Returns the value after multiplication, or null if the key/path doesn't exist or value is not numeric.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param path - Path to the numeric value
     * @param by - Amount to multiply by
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, path: RedisArgument, by: number) => void;
    readonly transformReply: {
        readonly 2: (reply: import("@redis/client/dist/lib/RESP/types").UnwrapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>) => number | (number | null)[];
        readonly 3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number> | import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").DoubleReply<number>>;
    };
};
export default _default;
//# sourceMappingURL=NUMMULTBY.d.ts.map