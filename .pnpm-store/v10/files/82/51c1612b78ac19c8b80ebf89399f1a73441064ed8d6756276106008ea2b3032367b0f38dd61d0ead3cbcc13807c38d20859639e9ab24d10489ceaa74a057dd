import { CommandParser } from '../client/parser';
import { RedisArgument, TuplesToMapReply, SimpleStringReply, NumberReply } from '../RESP/types';
export type VInfoReplyMap = TuplesToMapReply<[
    [
        SimpleStringReply<'quant-type'>,
        SimpleStringReply
    ],
    [
        SimpleStringReply<'vector-dim'>,
        NumberReply
    ],
    [
        SimpleStringReply<'size'>,
        NumberReply
    ],
    [
        SimpleStringReply<'max-level'>,
        NumberReply
    ],
    [
        SimpleStringReply<'vset-uid'>,
        NumberReply
    ],
    [
        SimpleStringReply<'hnsw-max-node-uid'>,
        NumberReply
    ]
]>;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Retrieve metadata and internal details about a vector set, including size, dimensions, quantization type, and graph structure
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @see https://redis.io/commands/vinfo/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument) => void;
    readonly transformReply: {
        readonly 2: (reply: [SimpleStringReply<"quant-type">, SimpleStringReply<string>, SimpleStringReply<"vector-dim">, NumberReply<number>, SimpleStringReply<"size">, NumberReply<number>, SimpleStringReply<"max-level">, NumberReply<number>, SimpleStringReply<"vset-uid">, NumberReply<number>, SimpleStringReply<"hnsw-max-node-uid">, NumberReply<number>]) => VInfoReplyMap;
        readonly 3: () => VInfoReplyMap;
    };
};
export default _default;
//# sourceMappingURL=VINFO.d.ts.map