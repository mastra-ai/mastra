import { CommandParser } from '../client/parser';
import { RedisArgument, TuplesToMapReply, BlobStringReply, ArrayReply, NullReply, SetReply, UnwrapReply, Resp2Reply } from '../RESP/types';
export interface FunctionListOptions {
    LIBRARYNAME?: RedisArgument;
}
export type FunctionListReplyItem = [
    [
        BlobStringReply<'library_name'>,
        BlobStringReply | NullReply
    ],
    [
        BlobStringReply<'engine'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'functions'>,
        ArrayReply<TuplesToMapReply<[
            [
                BlobStringReply<'name'>,
                BlobStringReply
            ],
            [
                BlobStringReply<'description'>,
                BlobStringReply | NullReply
            ],
            [
                BlobStringReply<'flags'>,
                SetReply<BlobStringReply>
            ]
        ]>>
    ]
];
export type FunctionListReply = ArrayReply<TuplesToMapReply<FunctionListReplyItem>>;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: false;
    /**
     * Returns all libraries and functions
     * @param parser - The Redis command parser
     * @param options - Options for listing functions
     */
    readonly parseCommand: (this: void, parser: CommandParser, options?: FunctionListOptions) => void;
    readonly transformReply: {
        readonly 2: (reply: UnwrapReply<Resp2Reply<FunctionListReply>>) => {
            library_name: NullReply | BlobStringReply<string>;
            engine: BlobStringReply<string>;
            functions: {
                name: BlobStringReply<string>;
                description: NullReply | BlobStringReply<string>;
                flags: import("../RESP/types").RespType<126, BlobStringReply<string>[], never, BlobStringReply<string>[]>;
            }[];
        }[];
        readonly 3: () => FunctionListReply;
    };
};
export default _default;
//# sourceMappingURL=FUNCTION_LIST.d.ts.map