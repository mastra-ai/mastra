import { CommandParser } from '../client/parser';
import { ArrayReply, UnwrapReply } from '../RESP/types';
import { CommandRawReply, CommandReply } from './generic-transformers';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns details about specific Redis commands
     * @param parser - The Redis command parser
     * @param commands - Array of command names to get information about
     */
    readonly parseCommand: (this: void, parser: CommandParser, commands: Array<string>) => void;
    readonly transformReply: (this: void, reply: UnwrapReply<ArrayReply<CommandRawReply>>) => Array<CommandReply | null>;
};
export default _default;
//# sourceMappingURL=COMMAND_INFO.d.ts.map