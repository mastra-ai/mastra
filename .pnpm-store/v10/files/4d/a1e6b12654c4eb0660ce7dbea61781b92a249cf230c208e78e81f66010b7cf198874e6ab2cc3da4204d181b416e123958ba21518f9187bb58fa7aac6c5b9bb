import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, SimpleStringReply } from '@redis/client/dist/lib/RESP/types';
export interface CfReserveOptions {
    BUCKETSIZE?: number;
    MAXITERATIONS?: number;
    EXPANSION?: number;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Creates an empty Cuckoo Filter with specified capacity and parameters
     * @param parser - The command parser
     * @param key - The name of the Cuckoo filter to create
     * @param capacity - The number of entries intended to be added to the filter
     * @param options - Optional parameters to tune the filter
     * @param options.BUCKETSIZE - Number of items in each bucket
     * @param options.MAXITERATIONS - Maximum number of iterations before declaring filter full
     * @param options.EXPANSION - Number of additional buckets per expansion
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, capacity: number, options?: CfReserveOptions) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=RESERVE.d.ts.map