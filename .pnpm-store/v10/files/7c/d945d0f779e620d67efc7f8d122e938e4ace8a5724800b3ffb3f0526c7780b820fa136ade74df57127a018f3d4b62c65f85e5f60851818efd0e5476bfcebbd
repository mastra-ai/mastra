import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, TuplesToMapReply, BlobStringReply, NumberReply, UnwrapReply, Resp2Reply } from '../RESP/types';
/**
 * Reply structure for XINFO CONSUMERS command
 *
 * @property name - Name of the consumer
 * @property pending - Number of pending messages for this consumer
 * @property idle - Idle time in milliseconds
 * @property inactive - Time in milliseconds since last interaction (Redis 7.2+)
 */
export type XInfoConsumersReply = ArrayReply<TuplesToMapReply<[
    [
        BlobStringReply<'name'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'pending'>,
        NumberReply
    ],
    [
        BlobStringReply<'idle'>,
        NumberReply
    ],
    /** added in 7.2 */
    [
        BlobStringReply<'inactive'>,
        NumberReply
    ]
]>>;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the XINFO CONSUMERS command to list the consumers in a consumer group
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - Name of the consumer group
     * @returns Array of consumer information objects
     * @see https://redis.io/commands/xinfo-consumers/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, group: RedisArgument) => void;
    readonly transformReply: {
        /**
         * Transforms RESP2 reply into a structured consumer information array
         *
         * @param reply - Raw RESP2 reply from Redis
         * @returns Array of consumer information objects
         */
        readonly 2: (reply: UnwrapReply<Resp2Reply<XInfoConsumersReply>>) => {
            name: BlobStringReply<string>;
            pending: NumberReply<number>;
            idle: NumberReply<number>;
            inactive: NumberReply<number>;
        }[];
        readonly 3: () => XInfoConsumersReply;
    };
};
export default _default;
//# sourceMappingURL=XINFO_CONSUMERS.d.ts.map