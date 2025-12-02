import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, BlobStringReply, NullReply } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Gets the values of all the specified fields in a hash.
     * @param parser - The Redis command parser.
     * @param key - Key of the hash.
     * @param fields - Fields to get from the hash.
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, fields: RedisVariadicArgument) => void;
    readonly transformReply: () => ArrayReply<BlobStringReply | NullReply>;
};
export default _default;
//# sourceMappingURL=HMGET.d.ts.map