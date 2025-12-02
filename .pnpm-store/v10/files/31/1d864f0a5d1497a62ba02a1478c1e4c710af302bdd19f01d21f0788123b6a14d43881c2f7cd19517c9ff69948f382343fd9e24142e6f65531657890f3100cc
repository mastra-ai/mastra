import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, MapReply, BlobStringReply, ArrayReply, UnwrapReply } from '@redis/client/dist/lib/RESP/types';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Dumps the contents of a synonym group.
     * @param parser - The command parser
     * @param index - Name of the index that contains the synonym group
     */
    readonly parseCommand: (this: void, parser: CommandParser, index: RedisArgument) => void;
    readonly transformReply: {
        readonly 2: (reply: UnwrapReply<ArrayReply<BlobStringReply | ArrayReply<BlobStringReply>>>) => Record<string, ArrayReply<BlobStringReply<string>>>;
        readonly 3: () => MapReply<BlobStringReply, ArrayReply<BlobStringReply>>;
    };
};
export default _default;
//# sourceMappingURL=SYNDUMP.d.ts.map