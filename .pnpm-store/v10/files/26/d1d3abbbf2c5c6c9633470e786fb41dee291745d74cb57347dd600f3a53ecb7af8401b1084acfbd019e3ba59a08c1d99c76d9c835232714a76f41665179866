import { CommandParser } from '../client/parser';
import { RedisArgument } from '../RESP/types';
export interface VAddOptions {
    REDUCE?: number;
    CAS?: boolean;
    QUANT?: 'NOQUANT' | 'BIN' | 'Q8';
    EF?: number;
    SETATTR?: Record<string, any>;
    M?: number;
}
declare const _default: {
    /**
     * Add a new element into the vector set specified by key
     *
     * @param parser - The command parser
     * @param key - The name of the key that will hold the vector set data
     * @param vector - The vector data as array of numbers
     * @param element - The name of the element being added to the vector set
     * @param options - Optional parameters for vector addition
     * @see https://redis.io/commands/vadd/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, vector: Array<number>, element: RedisArgument, options?: VAddOptions) => void;
    readonly transformReply: {
        2: (reply: import("../RESP/types").NumberReply<0 | 1>) => boolean;
        3: () => import("../RESP/types").BooleanReply<boolean>;
    };
};
export default _default;
//# sourceMappingURL=VADD.d.ts.map