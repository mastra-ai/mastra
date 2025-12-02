import { CommandParser } from '../client/parser';
import { RedisArgument, TuplesToMapReply, BlobStringReply, NumberReply, NullReply, TuplesReply, ArrayReply } from '../RESP/types';
/**
 * Reply structure for XINFO STREAM command containing detailed information about a stream
 *
 * @property length - Number of entries in the stream
 * @property radix-tree-keys - Number of radix tree keys
 * @property radix-tree-nodes - Number of radix tree nodes
 * @property last-generated-id - Last generated message ID
 * @property max-deleted-entry-id - Highest message ID deleted (Redis 7.2+)
 * @property entries-added - Total number of entries added (Redis 7.2+)
 * @property recorded-first-entry-id - ID of the first recorded entry (Redis 7.2+)
 * @property groups - Number of consumer groups
 * @property first-entry - First entry in the stream
 * @property last-entry - Last entry in the stream
 */
export type XInfoStreamReply = TuplesToMapReply<[
    [
        BlobStringReply<'length'>,
        NumberReply
    ],
    [
        BlobStringReply<'radix-tree-keys'>,
        NumberReply
    ],
    [
        BlobStringReply<'radix-tree-nodes'>,
        NumberReply
    ],
    [
        BlobStringReply<'last-generated-id'>,
        BlobStringReply
    ],
    /** added in 7.2 */
    [
        BlobStringReply<'max-deleted-entry-id'>,
        BlobStringReply
    ],
    /** added in 7.2 */
    [
        BlobStringReply<'entries-added'>,
        NumberReply
    ],
    /** added in 7.2 */
    [
        BlobStringReply<'recorded-first-entry-id'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'groups'>,
        NumberReply
    ],
    [
        BlobStringReply<'first-entry'>,
        ReturnType<typeof transformEntry>
    ],
    [
        BlobStringReply<'last-entry'>,
        ReturnType<typeof transformEntry>
    ]
]>;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the XINFO STREAM command to get detailed information about a stream
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @returns Detailed information about the stream including its length, structure, and entries
     * @see https://redis.io/commands/xinfo-stream/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: any) => {
            length: NumberReply<number>;
            "radix-tree-keys": NumberReply<number>;
            "radix-tree-nodes": NumberReply<number>;
            "last-generated-id": BlobStringReply<string>;
            "max-deleted-entry-id": BlobStringReply<string>;
            "entries-added": NumberReply<number>;
            "recorded-first-entry-id": BlobStringReply<string>;
            groups: NumberReply<number>;
            "first-entry": NullReply | {
                id: BlobStringReply<string>;
                message: import("../RESP/types").MapReply<BlobStringReply<string>, BlobStringReply<string>>;
            };
            "last-entry": NullReply | {
                id: BlobStringReply<string>;
                message: import("../RESP/types").MapReply<BlobStringReply<string>, BlobStringReply<string>>;
            };
        };
        readonly 3: (this: void, reply: any) => XInfoStreamReply;
    };
};
export default _default;
/**
 * Raw entry structure from Redis stream
 */
type RawEntry = TuplesReply<[
    id: BlobStringReply,
    message: ArrayReply<BlobStringReply>
]> | NullReply;
/**
 * Transforms a raw stream entry into a structured object
 *
 * @param entry - Raw entry from Redis
 * @returns Structured object with id and message, or null if entry is null
 */
declare function transformEntry(entry: RawEntry): NullReply | {
    id: BlobStringReply<string>;
    message: import("../RESP/types").MapReply<BlobStringReply<string>, BlobStringReply<string>>;
};
//# sourceMappingURL=XINFO_STREAM.d.ts.map