import { CommandParser } from '../client/parser';
import { RedisVariadicArgument } from './generic-transformers';
import { ArrayReply, NumberReply, RedisArgument } from '../RESP/types';
declare const _default: {
    /**
     * Sets the expiration for hash fields at a specific Unix timestamp
     * @param parser - The Redis command parser
     * @param key - Key of the hash
     * @param fields - Fields to set expiration on
     * @param timestamp - Unix timestamp (seconds since January 1, 1970) or Date object
     * @param mode - Expiration mode: NX (only if field has no expiry), XX (only if field has existing expiry), GT (only if new expiry is greater than current), LT (only if new expiry is less than current)
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, fields: RedisVariadicArgument, timestamp: number | Date, mode?: 'NX' | 'XX' | 'GT' | 'LT') => void;
    readonly transformReply: () => ArrayReply<NumberReply>;
};
export default _default;
//# sourceMappingURL=HEXPIREAT.d.ts.map