import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, TuplesToMapReply, NumberReply, SimpleStringReply, TypeMapping } from '@redis/client/dist/lib/RESP/types';
export type CmsInfoReplyMap = TuplesToMapReply<[
    [
        SimpleStringReply<'width'>,
        NumberReply
    ],
    [
        SimpleStringReply<'depth'>,
        NumberReply
    ],
    [
        SimpleStringReply<'count'>,
        NumberReply
    ]
]>;
export interface CmsInfoReply {
    width: NumberReply;
    depth: NumberReply;
    count: NumberReply;
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns width, depth, and total count of items in a Count-Min Sketch
     * @param parser - The command parser
     * @param key - The name of the sketch to get information about
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: [SimpleStringReply<"width">, NumberReply<number>, SimpleStringReply<"depth">, NumberReply<number>, SimpleStringReply<"count">, NumberReply<number>], _: any, typeMapping?: TypeMapping) => CmsInfoReply;
        readonly 3: () => CmsInfoReply;
    };
};
export default _default;
//# sourceMappingURL=INFO.d.ts.map