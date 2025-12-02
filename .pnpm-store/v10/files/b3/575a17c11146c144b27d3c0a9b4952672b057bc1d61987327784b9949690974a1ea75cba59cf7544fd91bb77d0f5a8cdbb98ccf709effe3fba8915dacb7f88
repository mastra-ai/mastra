import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, NullReply, NumberReply, TuplesToMapReply, SimpleStringReply, TypeMapping } from '@redis/client/dist/lib/RESP/types';
export type BfInfoReplyMap = TuplesToMapReply<[
    [
        SimpleStringReply<'Capacity'>,
        NumberReply
    ],
    [
        SimpleStringReply<'Size'>,
        NumberReply
    ],
    [
        SimpleStringReply<'Number of filters'>,
        NumberReply
    ],
    [
        SimpleStringReply<'Number of items inserted'>,
        NumberReply
    ],
    [
        SimpleStringReply<'Expansion rate'>,
        NullReply | NumberReply
    ]
]>;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns information about a Bloom Filter, including capacity, size, number of filters, items inserted, and expansion rate
     * @param parser - The command parser
     * @param key - The name of the Bloom filter to get information about
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: [SimpleStringReply<"Capacity">, NumberReply<number>, SimpleStringReply<"Size">, NumberReply<number>, SimpleStringReply<"Number of filters">, NumberReply<number>, SimpleStringReply<"Number of items inserted">, NumberReply<number>, SimpleStringReply<"Expansion rate">, NullReply | NumberReply<number>], _: any, typeMapping?: TypeMapping) => BfInfoReplyMap;
        readonly 3: () => BfInfoReplyMap;
    };
};
export default _default;
//# sourceMappingURL=INFO.d.ts.map