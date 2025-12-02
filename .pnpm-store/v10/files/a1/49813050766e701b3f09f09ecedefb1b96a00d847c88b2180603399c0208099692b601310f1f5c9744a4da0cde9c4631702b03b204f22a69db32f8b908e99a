import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument } from '@redis/client/dist/lib/RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns value estimates at requested quantiles from a t-digest sketch
     * @param parser - The command parser
     * @param key - The name of the t-digest sketch
     * @param quantiles - Array of quantiles (between 0 and 1) to get value estimates for
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, quantiles: Array<number>) => void;
    readonly transformReply: {
        2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[], preserve?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>[];
        3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").DoubleReply<number>>;
    };
};
export default _default;
//# sourceMappingURL=QUANTILE.d.ts.map