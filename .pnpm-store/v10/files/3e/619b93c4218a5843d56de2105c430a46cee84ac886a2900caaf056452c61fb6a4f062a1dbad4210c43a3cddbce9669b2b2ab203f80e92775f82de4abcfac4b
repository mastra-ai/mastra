import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { SimpleStringReply, RedisArgument } from '@redis/client/dist/lib/RESP/types';
export interface TopKReserveOptions {
    width: number;
    depth: number;
    decay: number;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Creates a new Top-K filter with specified parameters
     * @param parser - The command parser
     * @param key - The name of the Top-K filter
     * @param topK - Number of top occurring items to keep
     * @param options - Optional parameters for filter configuration
     * @param options.width - Number of counters in each array
     * @param options.depth - Number of counter-arrays
     * @param options.decay - Counter decay factor
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, topK: number, options?: TopKReserveOptions) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=RESERVE.d.ts.map