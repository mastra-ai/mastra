import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { BlobStringReply, ArrayReply, Resp2Reply, MapReply, TuplesReply, TypeMapping } from '@redis/client/dist/lib/RESP/types';
import { RedisVariadicArgument } from '@redis/client/dist/lib/commands/generic-transformers';
import { TsMGetOptions } from './MGET';
import { RawLabelValue, SampleRawReply } from './helpers';
export interface TsMGetWithLabelsOptions extends TsMGetOptions {
    SELECTED_LABELS?: RedisVariadicArgument;
}
export type MGetLabelsRawReply2<T extends RawLabelValue> = ArrayReply<TuplesReply<[
    key: BlobStringReply,
    labels: ArrayReply<TuplesReply<[
        label: BlobStringReply,
        value: T
    ]>>,
    sample: Resp2Reply<SampleRawReply>
]>>;
export type MGetLabelsRawReply3<T extends RawLabelValue> = MapReply<BlobStringReply, TuplesReply<[
    labels: MapReply<BlobStringReply, T>,
    sample: SampleRawReply
]>>;
export declare function createTransformMGetLabelsReply<T extends RawLabelValue>(): {
    2(this: void, reply: MGetLabelsRawReply2<T>, _: any, typeMapping?: TypeMapping): MapReply<BlobStringReply<string>, {
        labels: MapReply<BlobStringReply<string>, T>;
        sample: {
            timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
            value: number;
        };
    }>;
    3(this: void, reply: MGetLabelsRawReply3<T>): MapReply<BlobStringReply<string>, {
        labels: MapReply<BlobStringReply<string>, T>;
        sample: {
            timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
            value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
        };
    }>;
};
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets the last samples matching a specific filter with labels
     * @param parser - The command parser
     * @param filter - Filter to match time series keys
     * @param options - Optional parameters for the command
     */
    readonly parseCommand: (this: void, parser: CommandParser, filter: RedisVariadicArgument, options?: TsMGetWithLabelsOptions) => void;
    readonly transformReply: {
        2(this: void, reply: MGetLabelsRawReply2<BlobStringReply<string>>, _: any, typeMapping?: TypeMapping | undefined): MapReply<BlobStringReply<string>, {
            labels: MapReply<BlobStringReply<string>, BlobStringReply<string>>;
            sample: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            };
        }>;
        3(this: void, reply: MGetLabelsRawReply3<BlobStringReply<string>>): MapReply<BlobStringReply<string>, {
            labels: MapReply<BlobStringReply<string>, BlobStringReply<string>>;
            sample: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            };
        }>;
    };
};
export default _default;
//# sourceMappingURL=MGET_WITHLABELS.d.ts.map