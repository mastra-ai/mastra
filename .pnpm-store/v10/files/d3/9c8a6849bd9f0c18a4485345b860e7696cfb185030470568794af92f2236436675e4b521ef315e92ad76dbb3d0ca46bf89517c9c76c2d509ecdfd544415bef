import { CommandParser } from '../client/parser';
import { ArrayReply, TuplesReply, NumberReply } from '../RESP/types';
export type LatencyEventType = ('active-defrag-cycle' | 'aof-fsync-always' | 'aof-stat' | 'aof-rewrite-diff-write' | 'aof-rename' | 'aof-write' | 'aof-write-active-child' | 'aof-write-alone' | 'aof-write-pending-fsync' | 'command' | 'expire-cycle' | 'eviction-cycle' | 'eviction-del' | 'fast-command' | 'fork' | 'rdb-unlink-temp-file');
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the LATENCY HISTORY command
     *
     * @param parser - The command parser
     * @param event - The latency event to get the history for
     * @see https://redis.io/commands/latency-history/
     */
    readonly parseCommand: (this: void, parser: CommandParser, event: LatencyEventType) => void;
    readonly transformReply: () => ArrayReply<TuplesReply<[
        timestamp: NumberReply,
        latency: NumberReply
    ]>>;
};
export default _default;
//# sourceMappingURL=LATENCY_HISTORY.d.ts.map