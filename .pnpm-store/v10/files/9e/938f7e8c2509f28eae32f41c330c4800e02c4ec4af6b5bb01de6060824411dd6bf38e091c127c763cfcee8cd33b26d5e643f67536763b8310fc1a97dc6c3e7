import { CommandParser } from '../client/parser';
import { SimpleStringReply } from '../RESP/types';
export declare const REDIS_FLUSH_MODES: {
    readonly ASYNC: "ASYNC";
    readonly SYNC: "SYNC";
};
export type RedisFlushMode = typeof REDIS_FLUSH_MODES[keyof typeof REDIS_FLUSH_MODES];
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: false;
    /**
     * Removes all keys from all databases
     * @param parser - The Redis command parser
     * @param mode - Optional flush mode (ASYNC or SYNC)
     */
    readonly parseCommand: (this: void, parser: CommandParser, mode?: RedisFlushMode) => void;
    readonly transformReply: () => SimpleStringReply;
};
export default _default;
//# sourceMappingURL=FLUSHALL.d.ts.map