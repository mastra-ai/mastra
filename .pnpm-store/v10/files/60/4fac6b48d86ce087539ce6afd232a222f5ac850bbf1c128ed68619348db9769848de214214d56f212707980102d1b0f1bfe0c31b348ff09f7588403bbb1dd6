import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument } from '@redis/client/dist/lib/RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns the mean value from a t-digest sketch after trimming values at specified percentiles
     * @param parser - The command parser
     * @param key - The name of the t-digest sketch
     * @param lowCutPercentile - Lower percentile cutoff (between 0 and 100)
     * @param highCutPercentile - Higher percentile cutoff (between 0 and 100)
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, lowCutPercentile: number, highCutPercentile: number) => void;
    readonly transformReply: {
        2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, preserve?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
        3: () => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
    };
};
export default _default;
//# sourceMappingURL=TRIMMED_MEAN.d.ts.map