import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, TuplesReply, BlobStringReply, UnwrapReply } from '../RESP/types';
export type HRandFieldCountWithValuesReply = Array<{
    field: BlobStringReply;
    value: BlobStringReply;
}>;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the HRANDFIELD command with count parameter and WITHVALUES option
     *
     * @param parser - The command parser
     * @param key - The key of the hash to get random fields from
     * @param count - The number of fields to return (positive: unique fields, negative: may repeat fields)
     * @see https://redis.io/commands/hrandfield/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, count: number) => void;
    readonly transformReply: {
        readonly 2: (rawReply: UnwrapReply<ArrayReply<BlobStringReply>>) => HRandFieldCountWithValuesReply;
        readonly 3: (reply: UnwrapReply<ArrayReply<TuplesReply<[BlobStringReply, BlobStringReply]>>>) => {
            field: BlobStringReply<string>;
            value: BlobStringReply<string>;
        }[];
    };
};
export default _default;
//# sourceMappingURL=HRANDFIELD_COUNT_WITHVALUES.d.ts.map