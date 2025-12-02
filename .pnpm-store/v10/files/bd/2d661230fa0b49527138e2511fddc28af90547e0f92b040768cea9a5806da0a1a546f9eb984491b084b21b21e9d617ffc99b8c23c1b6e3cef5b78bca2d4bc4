import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, ArrayReply, NumberReply } from '@redis/client/dist/lib/RESP/types';
export declare function transformRankArguments(parser: CommandParser, key: RedisArgument, values: Array<number>): void;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns the rank of one or more values in a t-digest sketch (number of values that are lower than each value)
     * @param parser - The command parser
     * @param key - The name of the t-digest sketch
     * @param values - Array of values to get ranks for
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, values: number[]) => void;
    readonly transformReply: () => ArrayReply<NumberReply>;
};
export default _default;
//# sourceMappingURL=RANK.d.ts.map