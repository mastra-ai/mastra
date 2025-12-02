import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
/**
 * Command for removing messages from a stream
 */
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the XDEL command to remove one or more messages from a stream
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param id - One or more message IDs to delete
     * @returns The number of messages actually deleted
     * @see https://redis.io/commands/xdel/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, id: RedisVariadicArgument) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=XDEL.d.ts.map