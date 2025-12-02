import { CommandParser } from '../client/parser';
import { SimpleStringReply } from '../RESP/types';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Stops the server from processing client commands for the specified duration
     * @param parser - The Redis command parser
     * @param timeout - Time in milliseconds to pause command processing
     * @param mode - Optional mode: 'WRITE' to pause only write commands, 'ALL' to pause all commands
     */
    readonly parseCommand: (this: void, parser: CommandParser, timeout: number, mode?: 'WRITE' | 'ALL') => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=CLIENT_PAUSE.d.ts.map