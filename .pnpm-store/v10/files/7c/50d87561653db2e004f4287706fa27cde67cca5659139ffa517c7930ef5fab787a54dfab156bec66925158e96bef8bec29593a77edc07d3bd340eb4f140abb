import { CommandParser } from '../client/parser';
import { NumberReply, RedisArgument } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the XACK command to acknowledge the processing of stream messages in a consumer group
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - The consumer group name
     * @param id - One or more message IDs to acknowledge
     * @returns The number of messages successfully acknowledged
     * @see https://redis.io/commands/xack/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, group: RedisArgument, id: RedisVariadicArgument) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=XACK.d.ts.map