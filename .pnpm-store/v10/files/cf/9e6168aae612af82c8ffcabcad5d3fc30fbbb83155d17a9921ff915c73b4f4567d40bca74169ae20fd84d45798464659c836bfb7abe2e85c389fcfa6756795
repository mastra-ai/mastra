import { CommandParser } from '../client/parser';
import { UnwrapReply, NullReply, TuplesReply, BlobStringReply } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Removes and returns the first element in a list, or blocks until one is available
     * @param parser - The Redis command parser
     * @param key - Key of the list to pop from, or array of keys to try sequentially
     * @param timeout - Maximum seconds to block, 0 to block indefinitely
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisVariadicArgument, timeout: number) => void;
    readonly transformReply: (this: void, reply: UnwrapReply<NullReply | TuplesReply<[BlobStringReply, BlobStringReply]>>) => {
        key: BlobStringReply<string>;
        element: BlobStringReply<string>;
    } | null;
};
export default _default;
//# sourceMappingURL=BLPOP.d.ts.map