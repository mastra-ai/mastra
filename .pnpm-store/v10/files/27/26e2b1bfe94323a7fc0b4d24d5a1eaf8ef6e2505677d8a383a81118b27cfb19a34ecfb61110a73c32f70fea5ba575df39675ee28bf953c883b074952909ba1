import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, ArrayReply, SetReply, BlobStringReply } from '@redis/client/dist/lib/RESP/types';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns all terms in a dictionary.
     * @param parser - The command parser
     * @param dictionary - Name of the dictionary to dump
     */
    readonly parseCommand: (this: void, parser: CommandParser, dictionary: RedisArgument) => void;
    readonly transformReply: {
        readonly 2: () => ArrayReply<BlobStringReply>;
        readonly 3: () => SetReply<BlobStringReply>;
    };
};
export default _default;
//# sourceMappingURL=DICTDUMP.d.ts.map