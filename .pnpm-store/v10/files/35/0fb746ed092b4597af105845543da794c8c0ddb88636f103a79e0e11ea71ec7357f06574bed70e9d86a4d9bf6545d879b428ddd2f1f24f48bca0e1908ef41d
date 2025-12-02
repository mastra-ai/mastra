import { CommandParser } from '../client/parser';
import { SimpleStringReply } from '../RESP/types';
/**
 * Options for the SHUTDOWN command
 *
 * @property mode - NOSAVE will not save DB, SAVE will force save DB
 * @property NOW - Immediately terminate all clients
 * @property FORCE - Force shutdown even in case of errors
 * @property ABORT - Abort a shutdown in progress
 */
export interface ShutdownOptions {
    mode?: 'NOSAVE' | 'SAVE';
    NOW?: boolean;
    FORCE?: boolean;
    ABORT?: boolean;
}
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the SHUTDOWN command
     *
     * @param parser - The command parser
     * @param options - Options for the shutdown process
     * @see https://redis.io/commands/shutdown/
     */
    readonly parseCommand: (this: void, parser: CommandParser, options?: ShutdownOptions) => void;
    readonly transformReply: () => void | SimpleStringReply;
};
export default _default;
//# sourceMappingURL=SHUTDOWN.d.ts.map