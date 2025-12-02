import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
declare const _default: {
    /**
     * Sets the expiration for a key at a specific Unix timestamp
     * @param parser - The Redis command parser
     * @param key - Key to set expiration on
     * @param timestamp - Unix timestamp (seconds since January 1, 1970) or Date object
     * @param mode - Expiration mode: NX (only if key has no expiry), XX (only if key has existing expiry), GT (only if new expiry is greater than current), LT (only if new expiry is less than current)
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, timestamp: number | Date, mode?: 'NX' | 'XX' | 'GT' | 'LT') => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=EXPIREAT.d.ts.map