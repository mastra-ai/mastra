import { CommandParser } from '../client/parser';
import { RedisArgument, BlobStringReply, ArrayReply, NullReply } from '../RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Retrieve random elements of a vector set
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @param count - Optional number of elements to return
     * @see https://redis.io/commands/vrandmember/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, count?: number) => void;
    readonly transformReply: () => BlobStringReply | ArrayReply<BlobStringReply> | NullReply;
};
export default _default;
//# sourceMappingURL=VRANDMEMBER.d.ts.map