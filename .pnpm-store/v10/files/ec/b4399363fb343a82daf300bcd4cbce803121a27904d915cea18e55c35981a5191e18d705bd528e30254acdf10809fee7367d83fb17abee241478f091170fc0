import { CommandParser } from '../client/parser';
import { RedisArgument, TuplesToMapReply, BlobStringReply, ArrayReply, NumberReply, TuplesReply } from '../RESP/types';
export interface LcsIdxOptions {
    MINMATCHLEN?: number;
}
export type LcsIdxRange = TuplesReply<[
    start: NumberReply,
    end: NumberReply
]>;
export type LcsIdxMatches = ArrayReply<TuplesReply<[
    key1: LcsIdxRange,
    key2: LcsIdxRange
]>>;
export type LcsIdxReply = TuplesToMapReply<[
    [
        BlobStringReply<'matches'>,
        LcsIdxMatches
    ],
    [
        BlobStringReply<'len'>,
        NumberReply
    ]
]>;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the LCS command with IDX option
     *
     * @param parser - The command parser
     * @param key1 - First key containing the first string
     * @param key2 - Second key containing the second string
     * @param options - Additional options for the LCS IDX command
     * @see https://redis.io/commands/lcs/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key1: RedisArgument, key2: RedisArgument, options?: LcsIdxOptions) => void;
    readonly transformReply: {
        readonly 2: (reply: [BlobStringReply<"matches">, import("../RESP/types").RespType<42, import("../RESP/types").RespType<42, [import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>], never, [import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>]>[], never, import("../RESP/types").RespType<42, [import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>], never, [import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>]>[]>, BlobStringReply<"len">, NumberReply<number>]) => {
            matches: import("../RESP/types").RespType<42, import("../RESP/types").RespType<42, [import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>], never, [import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>]>[], never, import("../RESP/types").RespType<42, [import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>], never, [import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>]>[]>;
            len: NumberReply<number>;
        };
        readonly 3: () => LcsIdxReply;
    };
};
export default _default;
//# sourceMappingURL=LCS_IDX.d.ts.map