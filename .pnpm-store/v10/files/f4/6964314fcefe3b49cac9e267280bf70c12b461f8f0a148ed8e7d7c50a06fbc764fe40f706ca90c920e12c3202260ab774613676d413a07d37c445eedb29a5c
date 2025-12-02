import { CommandParser } from '../client/parser';
import { RedisArgument, SimpleStringReply } from '../RESP/types';
/**
 * Options for the RESTORE command
 *
 * @property REPLACE - Replace existing key
 * @property ABSTTL - Use the TTL value as absolute timestamp
 * @property IDLETIME - Set the idle time (seconds) for the key
 * @property FREQ - Set the frequency counter for LFU policy
 */
export interface RestoreOptions {
    REPLACE?: boolean;
    ABSTTL?: boolean;
    IDLETIME?: number;
    FREQ?: number;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the RESTORE command
     *
     * @param parser - The command parser
     * @param key - The key to restore
     * @param ttl - Time to live in milliseconds, 0 for no expiry
     * @param serializedValue - The serialized value from DUMP command
     * @param options - Options for the RESTORE command
     * @see https://redis.io/commands/restore/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, ttl: number, serializedValue: RedisArgument, options?: RestoreOptions) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=RESTORE.d.ts.map