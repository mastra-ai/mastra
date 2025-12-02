import { CommandParser } from '../client/parser';
import { ArrayReply, RedisArgument } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
export declare const HASH_EXPIRATION: {
    /** The field does not exist */
    readonly FIELD_NOT_EXISTS: -2;
    /** Specified NX | XX | GT | LT condition not met */
    readonly CONDITION_NOT_MET: 0;
    /** Expiration time was set or updated */
    readonly UPDATED: 1;
    /** Field deleted because the specified expiration time is in the past */
    readonly DELETED: 2;
};
export type HashExpiration = typeof HASH_EXPIRATION[keyof typeof HASH_EXPIRATION];
declare const _default: {
    /**
     * Sets a timeout on hash fields. After the timeout has expired, the fields will be automatically deleted
     * @param parser - The Redis command parser
     * @param key - Key of the hash
     * @param fields - Fields to set expiration on
     * @param seconds - Number of seconds until field expiration
     * @param mode - Expiration mode: NX (only if field has no expiry), XX (only if field has existing expiry), GT (only if new expiry is greater than current), LT (only if new expiry is less than current)
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, fields: RedisVariadicArgument, seconds: number, mode?: 'NX' | 'XX' | 'GT' | 'LT') => void;
    readonly transformReply: () => ArrayReply<HashExpiration>;
};
export default _default;
//# sourceMappingURL=HEXPIRE.d.ts.map