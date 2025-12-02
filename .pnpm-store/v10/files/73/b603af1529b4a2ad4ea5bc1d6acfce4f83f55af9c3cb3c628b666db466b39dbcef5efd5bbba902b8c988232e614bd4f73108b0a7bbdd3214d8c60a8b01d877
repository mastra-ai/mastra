import { CommandParser } from '../client/parser';
import { RedisArgument, SimpleStringReply } from '../RESP/types';
/**
 * Options for creating a consumer group
 *
 * @property MKSTREAM - Create the stream if it doesn't exist
 * @property ENTRIESREAD - Set the number of entries that were read in this consumer group (Redis 7.0+)
 */
export interface XGroupCreateOptions {
    MKSTREAM?: boolean;
    /**
     * added in 7.0
     */
    ENTRIESREAD?: number;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the XGROUP CREATE command to create a consumer group for a stream
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - Name of the consumer group
     * @param id - ID of the last delivered item in the stream ('$' for last item, '0' for all items)
     * @param options - Additional options for group creation
     * @returns 'OK' if successful
     * @see https://redis.io/commands/xgroup-create/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, group: RedisArgument, id: RedisArgument, options?: XGroupCreateOptions) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=XGROUP_CREATE.d.ts.map