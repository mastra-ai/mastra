import { CommandParser } from '../client/parser';
import { RedisArgument, BlobStringReply, NullReply } from '../RESP/types';
export type GetExOptions = {
    type: 'EX' | 'PX';
    value: number;
} | {
    type: 'EXAT' | 'PXAT';
    value: number | Date;
} | {
    type: 'PERSIST';
} | {
    /**
     * @deprecated Use `{ type: 'EX', value: number }` instead.
     */
    EX: number;
} | {
    /**
     * @deprecated Use `{ type: 'PX', value: number }` instead.
     */
    PX: number;
} | {
    /**
     * @deprecated Use `{ type: 'EXAT', value: number | Date }` instead.
     */
    EXAT: number | Date;
} | {
    /**
     * @deprecated Use `{ type: 'PXAT', value: number | Date }` instead.
     */
    PXAT: number | Date;
} | {
    /**
     * @deprecated Use `{ type: 'PERSIST' }` instead.
     */
    PERSIST: true;
};
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets the value of a key and optionally sets its expiration
     * @param parser - The Redis command parser
     * @param key - Key to get value from
     * @param options - Options for setting expiration
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, options: GetExOptions) => void;
    readonly transformReply: () => BlobStringReply | NullReply;
};
export default _default;
//# sourceMappingURL=GETEX.d.ts.map