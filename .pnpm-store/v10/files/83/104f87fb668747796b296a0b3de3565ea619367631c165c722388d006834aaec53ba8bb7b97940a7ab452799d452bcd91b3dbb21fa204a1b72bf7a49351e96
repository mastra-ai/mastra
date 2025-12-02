import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, ArrayReply, SetReply, BlobStringReply } from '@redis/client/dist/lib/RESP/types';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns the distinct values in a TAG field.
     * @param parser - The command parser
     * @param index - Name of the index
     * @param fieldName - Name of the TAG field to get values from
     */
    readonly parseCommand: (this: void, parser: CommandParser, index: RedisArgument, fieldName: RedisArgument) => void;
    readonly transformReply: {
        readonly 2: () => ArrayReply<BlobStringReply>;
        readonly 3: () => SetReply<BlobStringReply>;
    };
};
export default _default;
//# sourceMappingURL=TAGVALS.d.ts.map