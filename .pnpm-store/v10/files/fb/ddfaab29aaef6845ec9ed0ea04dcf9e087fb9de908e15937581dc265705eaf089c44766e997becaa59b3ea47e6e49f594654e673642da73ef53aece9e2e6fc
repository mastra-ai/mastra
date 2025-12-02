import { CommandParser } from '../client/parser';
import { TuplesReply, BlobStringReply, NumberReply, ArrayReply, UnwrapReply } from '../RESP/types';
type RawNode = TuplesReply<[
    host: BlobStringReply,
    port: NumberReply,
    id: BlobStringReply
]>;
type ClusterSlotsRawReply = ArrayReply<[
    from: NumberReply,
    to: NumberReply,
    master: RawNode,
    ...replicas: Array<RawNode>
]>;
export type ClusterSlotsNode = ReturnType<typeof transformNode>;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns information about which Redis Cluster node handles which hash slots
     * @param parser - The Redis command parser
     */
    readonly parseCommand: (this: void, parser: CommandParser) => void;
    readonly transformReply: (this: void, reply: UnwrapReply<ClusterSlotsRawReply>) => {
        from: NumberReply<number>;
        to: NumberReply<number>;
        master: {
            host: BlobStringReply<string>;
            port: NumberReply<number>;
            id: BlobStringReply<string>;
        };
        replicas: {
            host: BlobStringReply<string>;
            port: NumberReply<number>;
            id: BlobStringReply<string>;
        }[];
    }[];
};
export default _default;
declare function transformNode(node: RawNode): {
    host: BlobStringReply<string>;
    port: NumberReply<number>;
    id: BlobStringReply<string>;
};
//# sourceMappingURL=CLUSTER_SLOTS.d.ts.map