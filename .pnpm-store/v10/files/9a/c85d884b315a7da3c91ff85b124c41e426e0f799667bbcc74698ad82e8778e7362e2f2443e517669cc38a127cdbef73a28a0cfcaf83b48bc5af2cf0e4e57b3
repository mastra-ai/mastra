import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, BlobStringReply } from '../RESP/types';
import { ZKeys } from './generic-transformers';
export type ZInterKeyAndWeight = {
    key: RedisArgument;
    weight: number;
};
export type ZInterKeys<T> = T | [T, ...Array<T>];
export type ZInterKeysType = ZInterKeys<RedisArgument> | ZInterKeys<ZInterKeyAndWeight>;
export interface ZInterOptions {
    AGGREGATE?: 'SUM' | 'MIN' | 'MAX';
}
export declare function parseZInterArguments(parser: CommandParser, keys: ZKeys, options?: ZInterOptions): void;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Intersects multiple sorted sets and returns the result as a new sorted set.
     * @param parser - The Redis command parser.
     * @param keys - Keys of the sorted sets to intersect.
     * @param options - Optional parameters for the intersection operation.
     */
    readonly parseCommand: (this: void, parser: CommandParser, keys: ZInterKeysType, options?: ZInterOptions) => void;
    readonly transformReply: () => ArrayReply<BlobStringReply>;
};
export default _default;
//# sourceMappingURL=ZINTER.d.ts.map