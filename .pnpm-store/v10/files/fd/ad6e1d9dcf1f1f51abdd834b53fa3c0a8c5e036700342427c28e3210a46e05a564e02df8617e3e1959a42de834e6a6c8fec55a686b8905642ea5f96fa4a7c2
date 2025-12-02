import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, BlobStringReply, SetReply } from '../RESP/types';
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the SMEMBERS command
     *
     * @param parser - The command parser
     * @param key - The set key to get all members from
     * @see https://redis.io/commands/smembers/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument) => void;
    readonly transformReply: {
        readonly 2: () => ArrayReply<BlobStringReply>;
        readonly 3: () => SetReply<BlobStringReply>;
    };
};
export default _default;
//# sourceMappingURL=SMEMBERS.d.ts.map