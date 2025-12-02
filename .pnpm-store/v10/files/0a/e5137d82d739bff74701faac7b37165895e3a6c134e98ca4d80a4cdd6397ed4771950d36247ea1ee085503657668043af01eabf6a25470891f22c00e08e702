import { CommandParser } from '../client/parser';
import { RedisArgument, MapReply, BlobStringReply } from '../RESP/types';
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Gets all fields and values in a hash
     * @param parser - The Redis command parser
     * @param key - Key of the hash
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument) => void;
    readonly TRANSFORM_LEGACY_REPLY: true;
    readonly transformReply: {
        readonly 2: (reply: import("../RESP/types").ArrayReply<BlobStringReply<string>>, preserve?: any, typeMapping?: import("../RESP/types").TypeMapping | undefined) => MapReply<BlobStringReply<string>, BlobStringReply<string>>;
        readonly 3: () => MapReply<BlobStringReply, BlobStringReply>;
    };
};
export default _default;
//# sourceMappingURL=HGETALL.d.ts.map