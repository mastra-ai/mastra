import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, BlobStringReply } from '../RESP/types';
export declare const COMMAND_LIST_FILTER_BY: {
    readonly MODULE: "MODULE";
    readonly ACLCAT: "ACLCAT";
    readonly PATTERN: "PATTERN";
};
export type CommandListFilterBy = typeof COMMAND_LIST_FILTER_BY[keyof typeof COMMAND_LIST_FILTER_BY];
export interface CommandListOptions {
    FILTERBY?: {
        type: CommandListFilterBy;
        value: RedisArgument;
    };
}
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns a list of all commands supported by the Redis server
     * @param parser - The Redis command parser
     * @param options - Options for filtering the command list
     */
    readonly parseCommand: (this: void, parser: CommandParser, options?: CommandListOptions) => void;
    readonly transformReply: () => ArrayReply<BlobStringReply>;
};
export default _default;
//# sourceMappingURL=COMMAND_LIST.d.ts.map