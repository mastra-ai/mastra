import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, NullReply, BlobStringReply, DoubleReply, UnwrapReply, TypeMapping } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns the scores associated with the specified members in the sorted set stored at key.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param member - One or more members to get scores for.
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, member: RedisVariadicArgument) => void;
    readonly transformReply: {
        readonly 2: (reply: UnwrapReply<ArrayReply<NullReply | BlobStringReply>>, preserve?: any, typeMapping?: TypeMapping) => (DoubleReply<number> | null)[];
        readonly 3: () => ArrayReply<NullReply | DoubleReply>;
    };
};
export default _default;
//# sourceMappingURL=ZMSCORE.d.ts.map