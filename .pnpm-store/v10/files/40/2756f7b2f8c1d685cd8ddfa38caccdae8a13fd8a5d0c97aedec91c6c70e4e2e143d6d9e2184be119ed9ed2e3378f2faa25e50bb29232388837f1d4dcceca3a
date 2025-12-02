import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, TuplesToMapReply, BlobStringReply, NumberReply, NullReply, UnwrapReply, Resp2Reply } from '../RESP/types';
/**
 * Reply structure for XINFO GROUPS command containing information about consumer groups
 */
export type XInfoGroupsReply = ArrayReply<TuplesToMapReply<[
    [
        BlobStringReply<'name'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'consumers'>,
        NumberReply
    ],
    [
        BlobStringReply<'pending'>,
        NumberReply
    ],
    [
        BlobStringReply<'last-delivered-id'>,
        NumberReply
    ],
    /** added in 7.0 */
    [
        BlobStringReply<'entries-read'>,
        NumberReply | NullReply
    ],
    /** added in 7.0 */
    [
        BlobStringReply<'lag'>,
        NumberReply
    ]
]>>;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the XINFO GROUPS command to list the consumer groups of a stream
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @returns Array of consumer group information objects
     * @see https://redis.io/commands/xinfo-groups/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument) => void;
    readonly transformReply: {
        /**
         * Transforms RESP2 reply into a structured consumer group information array
         *
         * @param reply - Raw RESP2 reply from Redis
         * @returns Array of consumer group information objects containing:
         *          name - Name of the consumer group
         *          consumers - Number of consumers in the group
         *          pending - Number of pending messages for the group
         *          last-delivered-id - ID of the last delivered message
         *          entries-read - Number of entries read in the group (Redis 7.0+)
         *          lag - Number of entries not read by the group (Redis 7.0+)
         */
        readonly 2: (reply: UnwrapReply<Resp2Reply<XInfoGroupsReply>>) => {
            name: BlobStringReply<string>;
            consumers: NumberReply<number>;
            pending: NumberReply<number>;
            'last-delivered-id': NumberReply<number>;
            'entries-read': NullReply | NumberReply<number>;
            lag: NumberReply<number>;
        }[];
        readonly 3: () => XInfoGroupsReply;
    };
};
export default _default;
//# sourceMappingURL=XINFO_GROUPS.d.ts.map