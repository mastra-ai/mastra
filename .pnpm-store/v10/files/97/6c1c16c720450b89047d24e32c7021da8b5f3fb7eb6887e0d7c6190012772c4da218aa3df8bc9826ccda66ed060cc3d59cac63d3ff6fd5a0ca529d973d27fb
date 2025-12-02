import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, ArrayReply, BlobStringReply, NumberReply, UnwrapReply } from '@redis/client/dist/lib/RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns all items in a Top-K filter with their respective counts
     * @param parser - The command parser
     * @param key - The name of the Top-K filter
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument) => void;
    readonly transformReply: (this: void, rawReply: UnwrapReply<ArrayReply<BlobStringReply | NumberReply>>) => {
        item: BlobStringReply;
        count: NumberReply;
    }[];
};
export default _default;
//# sourceMappingURL=LIST_WITHCOUNT.d.ts.map