import { TuplesToMapReply, BlobStringReply, ArrayReply, TuplesReply, NumberReply } from '../RESP/types';
import { LcsIdxRange } from './LCS_IDX';
export type LcsIdxWithMatchLenMatches = ArrayReply<TuplesReply<[
    key1: LcsIdxRange,
    key2: LcsIdxRange,
    len: NumberReply
]>>;
export type LcsIdxWithMatchLenReply = TuplesToMapReply<[
    [
        BlobStringReply<'matches'>,
        LcsIdxWithMatchLenMatches
    ],
    [
        BlobStringReply<'len'>,
        NumberReply
    ]
]>;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the LCS command with IDX and WITHMATCHLEN options
     *
     * @param args - The same parameters as LCS_IDX command
     * @see https://redis.io/commands/lcs/
     */
    readonly parseCommand: (this: void, parser: import("../..").CommandParser, key1: import("../RESP/types").RedisArgument, key2: import("../RESP/types").RedisArgument, options?: import("./LCS_IDX").LcsIdxOptions | undefined) => void;
    readonly transformReply: {
        readonly 2: (reply: [BlobStringReply<"matches">, import("../RESP/types").RespType<42, import("../RESP/types").RespType<42, [import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, NumberReply<number>], never, [import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, NumberReply<number>]>[], never, import("../RESP/types").RespType<42, [import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, NumberReply<number>], never, [import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, NumberReply<number>]>[]>, BlobStringReply<"len">, NumberReply<number>]) => {
            matches: import("../RESP/types").RespType<42, import("../RESP/types").RespType<42, [import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, NumberReply<number>], never, [import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, NumberReply<number>]>[], never, import("../RESP/types").RespType<42, [import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, NumberReply<number>], never, [import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, import("../RESP/types").RespType<42, [NumberReply<number>, NumberReply<number>], never, [NumberReply<number>, NumberReply<number>]>, NumberReply<number>]>[]>;
            len: NumberReply<number>;
        };
        readonly 3: () => LcsIdxWithMatchLenReply;
    };
};
export default _default;
//# sourceMappingURL=LCS_IDX_WITHMATCHLEN.d.ts.map