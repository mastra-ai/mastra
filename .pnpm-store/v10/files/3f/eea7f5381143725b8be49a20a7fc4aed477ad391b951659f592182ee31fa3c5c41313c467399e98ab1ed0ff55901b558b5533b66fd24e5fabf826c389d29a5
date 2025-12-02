import { CommandParser } from '../client/parser';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Pops elements from multiple lists; blocks until elements are available
     * @param parser - The Redis command parser
     * @param timeout - Timeout in seconds, 0 to block indefinitely
     * @param args - Additional arguments for LMPOP command
     */
    readonly parseCommand: (this: void, parser: CommandParser, timeout: number, keys: import("./generic-transformers").RedisVariadicArgument, side: import("./generic-transformers").ListSide, options?: import("./LMPOP").LMPopOptions | undefined) => void;
    readonly transformReply: () => import("../RESP/types").NullReply | import("../RESP/types").TuplesReply<[key: import("../RESP/types").BlobStringReply<string>, elements: import("../RESP/types").BlobStringReply<string>[]]>;
};
export default _default;
//# sourceMappingURL=BLMPOP.d.ts.map