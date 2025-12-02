import { CommandParser } from '../client/parser';
import { ArrayReply, NumberReply, RedisArgument } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
export declare const HASH_EXPIRATION_TIME: {
    /** The field does not exist */
    readonly FIELD_NOT_EXISTS: -2;
    /** The field exists but has no associated expire */
    readonly NO_EXPIRATION: -1;
};
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns the absolute Unix timestamp (since January 1, 1970) at which the given hash fields will expire
     * @param parser - The Redis command parser
     * @param key - Key of the hash
     * @param fields - Fields to check expiration time
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, fields: RedisVariadicArgument) => void;
    readonly transformReply: () => ArrayReply<NumberReply>;
};
export default _default;
//# sourceMappingURL=HEXPIRETIME.d.ts.map