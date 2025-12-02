import { CommandParser } from '../client/parser';
import { ArrayReply, TuplesToMapReply, BlobStringReply, NumberReply, UnwrapReply, Resp2Reply } from '../RESP/types';
type ClusterLinksReply = ArrayReply<TuplesToMapReply<[
    [
        BlobStringReply<'direction'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'node'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'create-time'>,
        NumberReply
    ],
    [
        BlobStringReply<'events'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'send-buffer-allocated'>,
        NumberReply
    ],
    [
        BlobStringReply<'send-buffer-used'>,
        NumberReply
    ]
]>>;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns information about all cluster links (lower level connections to other nodes)
     * @param parser - The Redis command parser
     */
    readonly parseCommand: (this: void, parser: CommandParser) => void;
    readonly transformReply: {
        readonly 2: (reply: UnwrapReply<Resp2Reply<ClusterLinksReply>>) => {
            direction: BlobStringReply<string>;
            node: BlobStringReply<string>;
            'create-time': NumberReply<number>;
            events: BlobStringReply<string>;
            'send-buffer-allocated': NumberReply<number>;
            'send-buffer-used': NumberReply<number>;
        }[];
        readonly 3: () => ClusterLinksReply;
    };
};
export default _default;
//# sourceMappingURL=CLUSTER_LINKS.d.ts.map