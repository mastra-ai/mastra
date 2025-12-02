import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, BlobStringReply } from '../RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Retrieve the neighbors of a specified element in a vector set; the connections for each layer of the HNSW graph
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @param element - The name of the element to retrieve neighbors for
     * @see https://redis.io/commands/vlinks/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, element: RedisArgument) => void;
    readonly transformReply: () => ArrayReply<ArrayReply<BlobStringReply>>;
};
export default _default;
//# sourceMappingURL=VLINKS.d.ts.map