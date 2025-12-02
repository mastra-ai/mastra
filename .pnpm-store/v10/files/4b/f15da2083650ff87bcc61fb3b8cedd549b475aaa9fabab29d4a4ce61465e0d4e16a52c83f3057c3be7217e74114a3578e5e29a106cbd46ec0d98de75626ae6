import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, SimpleStringReply } from '@redis/client/dist/lib/RESP/types';
export interface BfReserveOptions {
    EXPANSION?: number;
    NONSCALING?: boolean;
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Creates an empty Bloom Filter with a given desired error ratio and initial capacity
     * @param parser - The command parser
     * @param key - The name of the Bloom filter to create
     * @param errorRate - The desired probability for false positives (between 0 and 1)
     * @param capacity - The number of entries intended to be added to the filter
     * @param options - Optional parameters to tune the filter
     * @param options.EXPANSION - Expansion rate for the filter
     * @param options.NONSCALING - Prevents the filter from creating additional sub-filters
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, errorRate: number, capacity: number, options?: BfReserveOptions) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=RESERVE.d.ts.map