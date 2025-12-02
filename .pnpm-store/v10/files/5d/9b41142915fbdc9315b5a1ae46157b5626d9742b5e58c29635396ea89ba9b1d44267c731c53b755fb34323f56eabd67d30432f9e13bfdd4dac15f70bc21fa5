import { CommandParser } from '../client/parser';
import { RedisArgument, BlobStringReply, NullReply } from '../RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Pops an element from a list, pushes it to another list and returns it; blocks until element is available
     * @param parser - The Redis command parser
     * @param source - Key of the source list to pop from
     * @param destination - Key of the destination list to push to
     * @param timeout - Maximum seconds to block, 0 to block indefinitely
     */
    readonly parseCommand: (this: void, parser: CommandParser, source: RedisArgument, destination: RedisArgument, timeout: number) => void;
    readonly transformReply: () => BlobStringReply | NullReply;
};
export default _default;
//# sourceMappingURL=BRPOPLPUSH.d.ts.map