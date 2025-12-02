import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
/**
 * Command for creating a new consumer in a consumer group
 */
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the XGROUP CREATECONSUMER command to create a new consumer in a consumer group
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - Name of the consumer group
     * @param consumer - Name of the consumer to create
     * @returns 1 if the consumer was created, 0 if it already existed
     * @see https://redis.io/commands/xgroup-createconsumer/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, group: RedisArgument, consumer: RedisArgument) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=XGROUP_CREATECONSUMER.d.ts.map