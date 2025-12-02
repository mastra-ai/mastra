/// <reference types="node" />
import { Command } from './RESP/types';
export type RedisScriptConfig = Command & {
    SCRIPT: string | Buffer;
    NUMBER_OF_KEYS?: number;
};
export interface SHA1 {
    SHA1: string;
}
export declare function defineScript<S extends RedisScriptConfig>(script: S): S & SHA1;
export declare function scriptSha1(script: RedisScriptConfig['SCRIPT']): string;
//# sourceMappingURL=lua-script.d.ts.map