import { CommandParser } from '../client/parser';
import { RedisArgument, BlobStringReply, NullReply } from '../RESP/types';
import { ListSide } from './generic-transformers';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Pop an element from a list, push it to another list and return it; or block until one is available
     * @param parser - The Redis command parser
     * @param source - Key of the source list
     * @param destination - Key of the destination list
     * @param sourceSide - Side of source list to pop from (LEFT or RIGHT)
     * @param destinationSide - Side of destination list to push to (LEFT or RIGHT)
     * @param timeout - Timeout in seconds, 0 to block indefinitely
     */
    readonly parseCommand: (this: void, parser: CommandParser, source: RedisArgument, destination: RedisArgument, sourceSide: ListSide, destinationSide: ListSide, timeout: number) => void;
    readonly transformReply: () => BlobStringReply | NullReply;
};
export default _default;
//# sourceMappingURL=BLMOVE.d.ts.map