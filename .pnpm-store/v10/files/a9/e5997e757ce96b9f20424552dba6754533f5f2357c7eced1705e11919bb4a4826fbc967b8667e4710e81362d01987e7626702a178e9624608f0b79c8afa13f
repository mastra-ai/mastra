import { CommandParser } from '../../client/parser';
import { RedisArgument, ArrayReply, BlobStringReply, MapReply, TypeMapping } from '../../RESP/types';
declare const _default: {
    /**
     * Returns a list of replicas for the specified master.
     * @param parser - The Redis command parser.
     * @param dbname - Name of the master.
     */
    readonly parseCommand: (this: void, parser: CommandParser, dbname: RedisArgument) => void;
    readonly transformReply: {
        readonly 2: (reply: ArrayReply<ArrayReply<BlobStringReply>>, preserve?: any, typeMapping?: TypeMapping) => MapReply<BlobStringReply<string>, BlobStringReply<string>>[];
        readonly 3: () => ArrayReply<MapReply<BlobStringReply, BlobStringReply>>;
    };
};
export default _default;
//# sourceMappingURL=SENTINEL_REPLICAS.d.ts.map