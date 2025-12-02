import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
/**
 * Command for removing a consumer from a consumer group
 */
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the XGROUP DELCONSUMER command to remove a consumer from a consumer group
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - Name of the consumer group
     * @param consumer - Name of the consumer to remove
     * @returns The number of pending messages owned by the deleted consumer
     * @see https://redis.io/commands/xgroup-delconsumer/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, group: RedisArgument, consumer: RedisArgument) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=XGROUP_DELCONSUMER.d.ts.map