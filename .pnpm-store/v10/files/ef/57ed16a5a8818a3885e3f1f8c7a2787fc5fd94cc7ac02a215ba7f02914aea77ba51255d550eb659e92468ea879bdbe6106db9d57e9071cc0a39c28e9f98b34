import { RedisArgument } from '../RESP/types';
import { RedisVariadicArgument } from '../commands/generic-transformers';
export interface CommandParser {
    redisArgs: ReadonlyArray<RedisArgument>;
    keys: ReadonlyArray<RedisArgument>;
    firstKey: RedisArgument | undefined;
    preserve: unknown;
    push: (...arg: Array<RedisArgument>) => unknown;
    pushVariadic: (vals: RedisVariadicArgument) => unknown;
    pushVariadicWithLength: (vals: RedisVariadicArgument) => unknown;
    pushVariadicNumber: (vals: number | Array<number>) => unknown;
    pushKey: (key: RedisArgument) => unknown;
    pushKeys: (keys: RedisVariadicArgument) => unknown;
    pushKeysLength: (keys: RedisVariadicArgument) => unknown;
}
export declare class BasicCommandParser implements CommandParser {
    #private;
    preserve: unknown;
    get redisArgs(): RedisArgument[];
    get keys(): RedisArgument[];
    get firstKey(): RedisArgument;
    get cacheKey(): string;
    push(...arg: Array<RedisArgument>): void;
    pushVariadic(vals: RedisVariadicArgument): void;
    pushVariadicWithLength(vals: RedisVariadicArgument): void;
    pushVariadicNumber(vals: number | number[]): void;
    pushKey(key: RedisArgument): void;
    pushKeysLength(keys: RedisVariadicArgument): void;
    pushKeys(keys: RedisVariadicArgument): void;
}
//# sourceMappingURL=parser.d.ts.map