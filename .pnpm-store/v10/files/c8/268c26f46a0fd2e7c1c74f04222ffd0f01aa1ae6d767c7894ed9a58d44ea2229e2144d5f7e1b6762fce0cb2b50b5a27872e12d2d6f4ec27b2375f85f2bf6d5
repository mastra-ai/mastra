import { CommandParser } from '../client/parser';
import { BlobStringReply } from '../RESP/types';
export declare const LATENCY_EVENTS: {
    readonly ACTIVE_DEFRAG_CYCLE: "active-defrag-cycle";
    readonly AOF_FSYNC_ALWAYS: "aof-fsync-always";
    readonly AOF_STAT: "aof-stat";
    readonly AOF_REWRITE_DIFF_WRITE: "aof-rewrite-diff-write";
    readonly AOF_RENAME: "aof-rename";
    readonly AOF_WRITE: "aof-write";
    readonly AOF_WRITE_ACTIVE_CHILD: "aof-write-active-child";
    readonly AOF_WRITE_ALONE: "aof-write-alone";
    readonly AOF_WRITE_PENDING_FSYNC: "aof-write-pending-fsync";
    readonly COMMAND: "command";
    readonly EXPIRE_CYCLE: "expire-cycle";
    readonly EVICTION_CYCLE: "eviction-cycle";
    readonly EVICTION_DEL: "eviction-del";
    readonly FAST_COMMAND: "fast-command";
    readonly FORK: "fork";
    readonly RDB_UNLINK_TEMP_FILE: "rdb-unlink-temp-file";
};
export type LatencyEvent = typeof LATENCY_EVENTS[keyof typeof LATENCY_EVENTS];
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the LATENCY GRAPH command
     *
     * @param parser - The command parser
     * @param event - The latency event to get the graph for
     * @see https://redis.io/commands/latency-graph/
     */
    readonly parseCommand: (this: void, parser: CommandParser, event: LatencyEvent) => void;
    readonly transformReply: () => BlobStringReply;
};
export default _default;
//# sourceMappingURL=LATENCY_GRAPH.d.ts.map