import { CommandParser } from '../client/parser';
import { SimpleStringReply, RedisArgument } from '../RESP/types';
export interface FunctionRestoreOptions {
    mode?: 'FLUSH' | 'APPEND' | 'REPLACE';
}
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: false;
    /**
     * Restores libraries from the dump payload
     * @param parser - The Redis command parser
     * @param dump - Serialized payload of functions to restore
     * @param options - Options for the restore operation
     */
    readonly parseCommand: (this: void, parser: CommandParser, dump: RedisArgument, options?: FunctionRestoreOptions) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=FUNCTION_RESTORE.d.ts.map