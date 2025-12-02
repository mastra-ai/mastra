import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { ArrayReply, BlobStringReply, SetReply } from '@redis/client/dist/lib/RESP/types';
import { RedisVariadicArgument } from '@redis/client/dist/lib/commands/generic-transformers';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Queries the index for time series matching a specific filter
     * @param parser - The command parser
     * @param filter - Filter to match time series labels
     */
    readonly parseCommand: (this: void, parser: CommandParser, filter: RedisVariadicArgument) => void;
    readonly transformReply: {
        readonly 2: () => ArrayReply<BlobStringReply>;
        readonly 3: () => SetReply<BlobStringReply>;
    };
};
export default _default;
//# sourceMappingURL=QUERYINDEX.d.ts.map