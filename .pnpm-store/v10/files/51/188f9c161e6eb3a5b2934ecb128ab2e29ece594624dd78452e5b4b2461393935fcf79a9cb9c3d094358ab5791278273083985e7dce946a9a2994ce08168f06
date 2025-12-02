import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, TuplesToMapReply, NumberReply, DoubleReply, SimpleStringReply, TypeMapping } from '@redis/client/dist/lib/RESP/types';
export type TopKInfoReplyMap = TuplesToMapReply<[
    [
        SimpleStringReply<'k'>,
        NumberReply
    ],
    [
        SimpleStringReply<'width'>,
        NumberReply
    ],
    [
        SimpleStringReply<'depth'>,
        NumberReply
    ],
    [
        SimpleStringReply<'decay'>,
        DoubleReply
    ]
]>;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns configuration and statistics of a Top-K filter, including k, width, depth, and decay parameters
     * @param parser - The command parser
     * @param key - The name of the Top-K filter to get information about
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument) => void;
    readonly transformReply: {
        readonly 2: (reply: [SimpleStringReply<"k">, NumberReply<number>, SimpleStringReply<"width">, NumberReply<number>, SimpleStringReply<"depth">, NumberReply<number>, SimpleStringReply<"decay">, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], preserve?: any, typeMapping?: TypeMapping) => TopKInfoReplyMap;
        readonly 3: () => TopKInfoReplyMap;
    };
};
export default _default;
//# sourceMappingURL=INFO.d.ts.map