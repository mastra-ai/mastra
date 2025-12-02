import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { ArrayReply, BlobStringReply, DoubleReply, NumberReply, ReplyUnion, SimpleStringReply, TypeMapping } from "@redis/client/dist/lib/RESP/types";
import { TimeSeriesDuplicatePolicies } from "./helpers";
import { TimeSeriesAggregationType } from "./CREATERULE";
export type InfoRawReplyTypes = SimpleStringReply | NumberReply | TimeSeriesDuplicatePolicies | null | Array<[name: BlobStringReply, value: BlobStringReply]> | BlobStringReply | Array<[key: BlobStringReply, timeBucket: NumberReply, aggregationType: TimeSeriesAggregationType]> | DoubleReply;
export type InfoRawReply = Array<InfoRawReplyTypes>;
export type InfoRawReplyOld = [
    'totalSamples',
    NumberReply,
    'memoryUsage',
    NumberReply,
    'firstTimestamp',
    NumberReply,
    'lastTimestamp',
    NumberReply,
    'retentionTime',
    NumberReply,
    'chunkCount',
    NumberReply,
    'chunkSize',
    NumberReply,
    'chunkType',
    SimpleStringReply,
    'duplicatePolicy',
    TimeSeriesDuplicatePolicies | null,
    'labels',
    ArrayReply<[name: BlobStringReply, value: BlobStringReply]>,
    'sourceKey',
    BlobStringReply | null,
    'rules',
    ArrayReply<[key: BlobStringReply, timeBucket: NumberReply, aggregationType: TimeSeriesAggregationType]>,
    'ignoreMaxTimeDiff',
    NumberReply,
    'ignoreMaxValDiff',
    DoubleReply
];
export interface InfoReply {
    totalSamples: NumberReply;
    memoryUsage: NumberReply;
    firstTimestamp: NumberReply;
    lastTimestamp: NumberReply;
    retentionTime: NumberReply;
    chunkCount: NumberReply;
    chunkSize: NumberReply;
    chunkType: SimpleStringReply;
    duplicatePolicy: TimeSeriesDuplicatePolicies | null;
    labels: Array<{
        name: BlobStringReply;
        value: BlobStringReply;
    }>;
    sourceKey: BlobStringReply | null;
    rules: Array<{
        key: BlobStringReply;
        timeBucket: NumberReply;
        aggregationType: TimeSeriesAggregationType;
    }>;
    /** Added in 7.4 */
    ignoreMaxTimeDiff: NumberReply;
    /** Added in 7.4 */
    ignoreMaxValDiff: DoubleReply;
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets information about a time series
     * @param parser - The command parser
     * @param key - The key name of the time series
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: string) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: InfoRawReply, _: any, typeMapping?: TypeMapping) => InfoReply;
        readonly 3: () => ReplyUnion;
    };
    readonly unstableResp3: true;
};
export default _default;
//# sourceMappingURL=INFO.d.ts.map