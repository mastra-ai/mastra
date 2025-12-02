import { CommandParser } from '../client/parser';
import { TuplesToMapReply, BlobStringReply, NumberReply, DoubleReply, ArrayReply, UnwrapReply, TypeMapping } from '../RESP/types';
export type MemoryStatsReply = TuplesToMapReply<[
    [
        BlobStringReply<'peak.allocated'>,
        NumberReply
    ],
    [
        BlobStringReply<'total.allocated'>,
        NumberReply
    ],
    [
        BlobStringReply<'startup.allocated'>,
        NumberReply
    ],
    [
        BlobStringReply<'replication.backlog'>,
        NumberReply
    ],
    [
        BlobStringReply<'clients.slaves'>,
        NumberReply
    ],
    [
        BlobStringReply<'clients.normal'>,
        NumberReply
    ],
    /** added in 7.0 */
    [
        BlobStringReply<'cluster.links'>,
        NumberReply
    ],
    [
        BlobStringReply<'aof.buffer'>,
        NumberReply
    ],
    [
        BlobStringReply<'lua.caches'>,
        NumberReply
    ],
    /** added in 7.0 */
    [
        BlobStringReply<'functions.caches'>,
        NumberReply
    ],
    [
        BlobStringReply<'overhead.total'>,
        NumberReply
    ],
    [
        BlobStringReply<'keys.count'>,
        NumberReply
    ],
    [
        BlobStringReply<'keys.bytes-per-key'>,
        NumberReply
    ],
    [
        BlobStringReply<'dataset.bytes'>,
        NumberReply
    ],
    [
        BlobStringReply<'dataset.percentage'>,
        DoubleReply
    ],
    [
        BlobStringReply<'peak.percentage'>,
        DoubleReply
    ],
    [
        BlobStringReply<'allocator.allocated'>,
        NumberReply
    ],
    [
        BlobStringReply<'allocator.active'>,
        NumberReply
    ],
    [
        BlobStringReply<'allocator.resident'>,
        NumberReply
    ],
    [
        BlobStringReply<'allocator-fragmentation.ratio'>,
        DoubleReply
    ],
    [
        BlobStringReply<'allocator-fragmentation.bytes'>,
        NumberReply
    ],
    [
        BlobStringReply<'allocator-rss.ratio'>,
        DoubleReply
    ],
    [
        BlobStringReply<'allocator-rss.bytes'>,
        NumberReply
    ],
    [
        BlobStringReply<'rss-overhead.ratio'>,
        DoubleReply
    ],
    [
        BlobStringReply<'rss-overhead.bytes'>,
        NumberReply
    ],
    [
        BlobStringReply<'fragmentation'>,
        DoubleReply
    ],
    [
        BlobStringReply<'fragmentation.bytes'>,
        NumberReply
    ]
]>;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the MEMORY STATS command
     *
     * @param parser - The command parser
     * @see https://redis.io/commands/memory-stats/
     */
    readonly parseCommand: (this: void, parser: CommandParser) => void;
    readonly transformReply: {
        readonly 2: (rawReply: UnwrapReply<ArrayReply<BlobStringReply | NumberReply>>, preserve?: any, typeMapping?: TypeMapping) => MemoryStatsReply;
        readonly 3: () => MemoryStatsReply;
    };
};
export default _default;
//# sourceMappingURL=MEMORY_STATS.d.ts.map