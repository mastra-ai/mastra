import { CommandParser } from '../client/parser';
import { RedisArgument, SimpleStringReply } from '../RESP/types';
/**
 * Options for setting a consumer group's ID position
 *
 * @property ENTRIESREAD - Set the number of entries that were read in this consumer group (Redis 7.0+)
 */
export interface XGroupSetIdOptions {
    /** added in 7.0 */
    ENTRIESREAD?: number;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the XGROUP SETID command to set the last delivered ID for a consumer group
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - Name of the consumer group
     * @param id - ID to set as last delivered message ('$' for last item, '0' for all items)
     * @param options - Additional options for setting the group ID
     * @returns 'OK' if successful
     * @see https://redis.io/commands/xgroup-setid/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, group: RedisArgument, id: RedisArgument, options?: XGroupSetIdOptions) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=XGROUP_SETID.d.ts.map