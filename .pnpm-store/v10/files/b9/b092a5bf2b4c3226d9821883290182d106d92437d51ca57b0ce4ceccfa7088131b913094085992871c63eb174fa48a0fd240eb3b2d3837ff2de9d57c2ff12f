import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { ArrayReply, TuplesReply, BlobStringReply, NullReply, UnwrapReply } from '@redis/client/dist/lib/RESP/types';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Gets a RediSearch configuration option value.
     * @param parser - The command parser
     * @param option - The name of the configuration option to retrieve
     */
    readonly parseCommand: (this: void, parser: CommandParser, option: string) => void;
    readonly transformReply: (this: void, reply: UnwrapReply<ArrayReply<TuplesReply<[BlobStringReply, BlobStringReply | NullReply]>>>) => Record<string, BlobStringReply<string> | NullReply>;
};
export default _default;
//# sourceMappingURL=CONFIG_GET.d.ts.map