import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument } from '@redis/client/dist/lib/RESP/types';
export declare function transformByRankArguments(parser: CommandParser, key: RedisArgument, ranks: Array<number>): void;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns value estimates for one or more ranks in a t-digest sketch
     * @param parser - The command parser
     * @param key - The name of the t-digest sketch
     * @param ranks - Array of ranks to get value estimates for (ascending order)
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, ranks: number[]) => void;
    readonly transformReply: {
        2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[], preserve?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>[];
        3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").DoubleReply<number>>;
    };
};
export default _default;
//# sourceMappingURL=BYRANK.d.ts.map