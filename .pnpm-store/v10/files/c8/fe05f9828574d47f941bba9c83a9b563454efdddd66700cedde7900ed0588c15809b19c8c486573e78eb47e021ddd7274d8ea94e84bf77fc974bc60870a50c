import { CommandParser } from '../client/parser';
import { RedisArgument, SimpleStringReply, BlobStringReply, NullReply } from '../RESP/types';
export interface SetOptions {
    expiration?: {
        type: 'EX' | 'PX' | 'EXAT' | 'PXAT';
        value: number;
    } | {
        type: 'KEEPTTL';
    } | 'KEEPTTL';
    /**
     * @deprecated Use `expiration` { type: 'EX', value: number } instead
     */
    EX?: number;
    /**
     * @deprecated Use `expiration` { type: 'PX', value: number } instead
     */
    PX?: number;
    /**
     * @deprecated Use `expiration` { type: 'EXAT', value: number } instead
     */
    EXAT?: number;
    /**
     * @deprecated Use `expiration` { type: 'PXAT', value: number } instead
     */
    PXAT?: number;
    /**
     * @deprecated Use `expiration` 'KEEPTTL' instead
     */
    KEEPTTL?: boolean;
    condition?: 'NX' | 'XX';
    /**
     * @deprecated Use `{ condition: 'NX' }` instead.
     */
    NX?: boolean;
    /**
     * @deprecated Use `{ condition: 'XX' }` instead.
     */
    XX?: boolean;
    GET?: boolean;
}
declare const _default: {
    /**
     * Constructs the SET command
     *
     * @param parser - The command parser
     * @param key - The key to set
     * @param value - The value to set
     * @param options - Additional options for the SET command
     * @see https://redis.io/commands/set/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, value: RedisArgument | number, options?: SetOptions) => void;
    readonly transformReply: () => SimpleStringReply<'OK'> | BlobStringReply | NullReply;
};
export default _default;
//# sourceMappingURL=SET.d.ts.map