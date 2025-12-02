import { ReplyUnion } from '@redis/client/dist/lib/RESP/types';
import { SearchRawReply } from './SEARCH';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Performs a search query but returns only document ids without their contents.
     * @param args - Same parameters as FT.SEARCH:
     *   - parser: The command parser
     *   - index: Name of the index to search
     *   - query: The text query to search
     *   - options: Optional search parameters
     */
    readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, index: import("@redis/client/dist/lib/RESP/types").RedisArgument, query: import("@redis/client/dist/lib/RESP/types").RedisArgument, options?: import("./SEARCH").FtSearchOptions | undefined) => void;
    readonly transformReply: {
        readonly 2: (reply: SearchRawReply) => SearchNoContentReply;
        readonly 3: () => ReplyUnion;
    };
    readonly unstableResp3: true;
};
export default _default;
export interface SearchNoContentReply {
    total: number;
    documents: Array<string>;
}
//# sourceMappingURL=SEARCH_NOCONTENT.d.ts.map