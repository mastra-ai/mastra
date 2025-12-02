import { CommandParser } from '../client/parser';
import { RedisArgument, BlobStringReply, NullReply } from '../RESP/types';
import { ListSide } from './generic-transformers';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the LMOVE command
     *
     * @param parser - The command parser
     * @param source - The source list key
     * @param destination - The destination list key
     * @param sourceSide - The side to pop from (LEFT or RIGHT)
     * @param destinationSide - The side to push to (LEFT or RIGHT)
     * @see https://redis.io/commands/lmove/
     */
    readonly parseCommand: (this: void, parser: CommandParser, source: RedisArgument, destination: RedisArgument, sourceSide: ListSide, destinationSide: ListSide) => void;
    readonly transformReply: () => BlobStringReply | NullReply;
};
export default _default;
//# sourceMappingURL=LMOVE.d.ts.map