import { CommandParser } from '../client/parser';
import { NumberReply } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
/**
 * Options for the SINTERCARD command
 *
 * @property LIMIT - Maximum number of elements to return
 */
export interface SInterCardOptions {
    LIMIT?: number;
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the SINTERCARD command
     *
     * @param parser - The command parser
     * @param keys - One or more set keys to compute the intersection cardinality from
     * @param options - Options for the SINTERCARD command or a number for LIMIT (backwards compatibility)
     * @see https://redis.io/commands/sintercard/
     */
    readonly parseCommand: (this: void, parser: CommandParser, keys: RedisVariadicArgument, options?: SInterCardOptions | number) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=SINTERCARD.d.ts.map