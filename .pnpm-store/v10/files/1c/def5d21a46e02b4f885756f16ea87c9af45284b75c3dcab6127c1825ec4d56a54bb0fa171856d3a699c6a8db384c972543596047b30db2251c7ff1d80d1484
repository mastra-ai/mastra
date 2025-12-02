import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument } from '@redis/client/dist/lib/RESP/types';
import { Timestamp, SamplesRawReply } from './helpers';
import { TimeSeriesAggregationType } from './CREATERULE';
export declare const TIME_SERIES_BUCKET_TIMESTAMP: {
    LOW: string;
    MIDDLE: string;
    END: string;
};
export type TimeSeriesBucketTimestamp = typeof TIME_SERIES_BUCKET_TIMESTAMP[keyof typeof TIME_SERIES_BUCKET_TIMESTAMP];
export interface TsRangeOptions {
    LATEST?: boolean;
    FILTER_BY_TS?: Array<Timestamp>;
    FILTER_BY_VALUE?: {
        min: number;
        max: number;
    };
    COUNT?: number;
    ALIGN?: Timestamp;
    AGGREGATION?: {
        ALIGN?: Timestamp;
        type: TimeSeriesAggregationType;
        timeBucket: Timestamp;
        BUCKETTIMESTAMP?: TimeSeriesBucketTimestamp;
        EMPTY?: boolean;
    };
}
export declare function parseRangeArguments(parser: CommandParser, fromTimestamp: Timestamp, toTimestamp: Timestamp, options?: TsRangeOptions): void;
export declare function transformRangeArguments(parser: CommandParser, key: RedisArgument, fromTimestamp: Timestamp, toTimestamp: Timestamp, options?: TsRangeOptions): void;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets samples from a time series within a time range
     * @param args - Arguments passed to the {@link transformRangeArguments} function
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, fromTimestamp: Timestamp, toTimestamp: Timestamp, options?: TsRangeOptions | undefined) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: import("@redis/client/dist/lib/RESP/types").RespType<42, import("@redis/client/dist/lib/RESP/types").RespType<42, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], never, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>]>[], never, import("@redis/client/dist/lib/RESP/types").RespType<42, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], never, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>]>[]>) => {
            timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
            value: number;
        }[];
        readonly 3: (this: void, reply: SamplesRawReply) => {
            timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
            value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
        }[];
    };
};
export default _default;
//# sourceMappingURL=RANGE.d.ts.map