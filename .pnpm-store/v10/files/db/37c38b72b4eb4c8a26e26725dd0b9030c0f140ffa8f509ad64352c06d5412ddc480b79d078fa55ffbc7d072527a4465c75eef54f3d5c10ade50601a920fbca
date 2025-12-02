import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, NumberReply } from '@redis/client/dist/lib/RESP/types';
import { TimeSeriesEncoding, TimeSeriesDuplicatePolicies, Labels, Timestamp } from './helpers';
export interface TsIgnoreOptions {
    maxTimeDiff: number;
    maxValDiff: number;
}
export interface TsAddOptions {
    RETENTION?: number;
    ENCODING?: TimeSeriesEncoding;
    CHUNK_SIZE?: number;
    ON_DUPLICATE?: TimeSeriesDuplicatePolicies;
    LABELS?: Labels;
    IGNORE?: TsIgnoreOptions;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Creates or appends a sample to a time series
     * @param parser - The command parser
     * @param key - The key name for the time series
     * @param timestamp - The timestamp of the sample
     * @param value - The value of the sample
     * @param options - Optional configuration parameters
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, timestamp: Timestamp, value: number, options?: TsAddOptions) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=ADD.d.ts.map