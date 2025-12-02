import { TuplesToMapReply, BlobStringReply, ArrayReply, UnwrapReply, Resp2Reply } from '../RESP/types';
import { FunctionListReplyItem } from './FUNCTION_LIST';
export type FunctionListWithCodeReply = ArrayReply<TuplesToMapReply<[
    ...FunctionListReplyItem,
    [
        BlobStringReply<'library_code'>,
        BlobStringReply
    ]
]>>;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: false;
    /**
     * Returns all libraries and functions including their source code
     * @param parser - The Redis command parser
     * @param options - Options for listing functions
     */
    readonly parseCommand: (this: void, parser: import("../..").CommandParser, options?: import("./FUNCTION_LIST").FunctionListOptions | undefined) => void;
    readonly transformReply: {
        readonly 2: (reply: UnwrapReply<Resp2Reply<FunctionListWithCodeReply>>) => {
            library_name: import("../RESP/types").NullReply | BlobStringReply<string>;
            engine: BlobStringReply<string>;
            functions: {
                name: BlobStringReply<string>;
                description: import("../RESP/types").NullReply | BlobStringReply<string>;
                flags: import("../RESP/types").RespType<126, BlobStringReply<string>[], never, BlobStringReply<string>[]>;
            }[];
            library_code: BlobStringReply<string>;
        }[];
        readonly 3: () => FunctionListWithCodeReply;
    };
};
export default _default;
//# sourceMappingURL=FUNCTION_LIST_WITHCODE.d.ts.map