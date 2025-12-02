/// <reference types="node" />
import { CommandParser } from "@redis/client/dist/lib/client/parser";
import { TsIgnoreOptions } from "./ADD";
import { ArrayReply, BlobStringReply, DoubleReply, MapReply, NullReply, NumberReply, ReplyUnion, RespType, TuplesReply, TypeMapping, UnwrapReply } from "@redis/client/dist/lib/RESP/types";
import { RedisVariadicArgument } from "@redis/client/dist/lib/commands/generic-transformers";
export declare function parseIgnoreArgument(parser: CommandParser, ignore?: TsIgnoreOptions): void;
export declare function parseRetentionArgument(parser: CommandParser, retention?: number): void;
export declare const TIME_SERIES_ENCODING: {
    readonly COMPRESSED: "COMPRESSED";
    readonly UNCOMPRESSED: "UNCOMPRESSED";
};
export type TimeSeriesEncoding = typeof TIME_SERIES_ENCODING[keyof typeof TIME_SERIES_ENCODING];
export declare function parseEncodingArgument(parser: CommandParser, encoding?: TimeSeriesEncoding): void;
export declare function parseChunkSizeArgument(parser: CommandParser, chunkSize?: number): void;
export declare const TIME_SERIES_DUPLICATE_POLICIES: {
    readonly BLOCK: "BLOCK";
    readonly FIRST: "FIRST";
    readonly LAST: "LAST";
    readonly MIN: "MIN";
    readonly MAX: "MAX";
    readonly SUM: "SUM";
};
export type TimeSeriesDuplicatePolicies = typeof TIME_SERIES_DUPLICATE_POLICIES[keyof typeof TIME_SERIES_DUPLICATE_POLICIES];
export declare function parseDuplicatePolicy(parser: CommandParser, duplicatePolicy?: TimeSeriesDuplicatePolicies): void;
export type Timestamp = number | Date | string;
export declare function transformTimestampArgument(timestamp: Timestamp): string;
export type Labels = {
    [label: string]: string;
};
export declare function parseLabelsArgument(parser: CommandParser, labels?: Labels): void;
export type SampleRawReply = TuplesReply<[timestamp: NumberReply, value: DoubleReply]>;
export declare const transformSampleReply: {
    2(reply: RespType<42, [NumberReply<number>, BlobStringReply<string>], never, [NumberReply<number>, BlobStringReply<string>]>): {
        timestamp: NumberReply<number>;
        value: number;
    };
    3(reply: SampleRawReply): {
        timestamp: NumberReply<number>;
        value: DoubleReply<number>;
    };
};
export type SamplesRawReply = ArrayReply<SampleRawReply>;
export declare const transformSamplesReply: {
    2(reply: RespType<42, RespType<42, [NumberReply<number>, BlobStringReply<string>], never, [NumberReply<number>, BlobStringReply<string>]>[], never, RespType<42, [NumberReply<number>, BlobStringReply<string>], never, [NumberReply<number>, BlobStringReply<string>]>[]>): {
        timestamp: NumberReply<number>;
        value: number;
    }[];
    3(reply: SamplesRawReply): {
        timestamp: NumberReply<number>;
        value: DoubleReply<number>;
    }[];
};
export declare function resp2MapToValue<RAW_VALUE extends TuplesReply<[key: BlobStringReply, ...rest: Array<ReplyUnion>]>, TRANSFORMED>(wrappedReply: ArrayReply<RAW_VALUE>, parseFunc: (rawValue: UnwrapReply<RAW_VALUE>) => TRANSFORMED, typeMapping?: TypeMapping): MapReply<BlobStringReply, TRANSFORMED>;
export declare function resp3MapToValue<RAW_VALUE extends RespType<any, any, any, any>, // TODO: simplify types
TRANSFORMED>(wrappedReply: MapReply<BlobStringReply, RAW_VALUE>, parseFunc: (rawValue: UnwrapReply<RAW_VALUE>) => TRANSFORMED): MapReply<BlobStringReply, TRANSFORMED>;
export declare function parseSelectedLabelsArguments(parser: CommandParser, selectedLabels: RedisVariadicArgument): void;
export type RawLabelValue = BlobStringReply | NullReply;
export type RawLabels<T extends RawLabelValue> = ArrayReply<TuplesReply<[
    label: BlobStringReply,
    value: T
]>>;
export declare function transformRESP2Labels<T extends RawLabelValue>(labels: RawLabels<T>, typeMapping?: TypeMapping): MapReply<BlobStringReply, T>;
export declare function transformRESP2LabelsWithSources<T extends RawLabelValue>(labels: RawLabels<T>, typeMapping?: TypeMapping): {
    labels: MapReply<BlobStringReply<string>, T>;
    sources: string[] | Buffer[];
};
//# sourceMappingURL=helpers.d.ts.map