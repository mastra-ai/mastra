import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { BlobStringReply, NullReply } from '@redis/client/dist/lib/RESP/types';
import { RedisVariadicArgument } from '@redis/client/dist/lib/commands/generic-transformers';
import { TsMGetOptions } from './MGET';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets the last samples matching a specific filter with selected labels
     * @param parser - The command parser
     * @param filter - Filter to match time series keys
     * @param selectedLabels - Labels to include in the output
     * @param options - Optional parameters for the command
     */
    readonly parseCommand: (this: void, parser: CommandParser, filter: RedisVariadicArgument, selectedLabels: RedisVariadicArgument, options?: TsMGetOptions) => void;
    readonly transformReply: {
        2(this: void, reply: import("./MGET_WITHLABELS").MGetLabelsRawReply2<NullReply | BlobStringReply<string>>, _: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined): import("@redis/client/dist/lib/RESP/types").MapReply<BlobStringReply<string>, {
            labels: import("@redis/client/dist/lib/RESP/types").MapReply<BlobStringReply<string>, NullReply | BlobStringReply<string>>;
            sample: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            };
        }>;
        3(this: void, reply: import("./MGET_WITHLABELS").MGetLabelsRawReply3<NullReply | BlobStringReply<string>>): import("@redis/client/dist/lib/RESP/types").MapReply<BlobStringReply<string>, {
            labels: import("@redis/client/dist/lib/RESP/types").MapReply<BlobStringReply<string>, NullReply | BlobStringReply<string>>;
            sample: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            };
        }>;
    };
};
export default _default;
//# sourceMappingURL=MGET_SELECTED_LABELS.d.ts.map