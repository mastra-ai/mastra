import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
declare const _default: {
    /**
     * Sets a timeout on key. After the timeout has expired, the key will be automatically deleted
     * @param parser - The Redis command parser
     * @param key - Key to set expiration on
     * @param seconds - Number of seconds until key expiration
     * @param mode - Expiration mode: NX (only if key has no expiry), XX (only if key has existing expiry), GT (only if new expiry is greater than current), LT (only if new expiry is less than current)
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, seconds: number, mode?: 'NX' | 'XX' | 'GT' | 'LT') => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=EXPIRE.d.ts.map