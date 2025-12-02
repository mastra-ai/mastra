import { CommandParser } from '../client/parser';
import { ArrayReply, TuplesToMapReply, BlobStringReply, NumberReply, DoubleReply, UnwrapReply, Resp2Reply, TypeMapping } from '../RESP/types';
export type AclLogReply = ArrayReply<TuplesToMapReply<[
    [
        BlobStringReply<'count'>,
        NumberReply
    ],
    [
        BlobStringReply<'reason'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'context'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'object'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'username'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'age-seconds'>,
        DoubleReply
    ],
    [
        BlobStringReply<'client-info'>,
        BlobStringReply
    ],
    /** added in 7.0 */
    [
        BlobStringReply<'entry-id'>,
        NumberReply
    ],
    /** added in 7.0 */
    [
        BlobStringReply<'timestamp-created'>,
        NumberReply
    ],
    /** added in 7.0 */
    [
        BlobStringReply<'timestamp-last-updated'>,
        NumberReply
    ]
]>>;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns ACL security events log entries
     * @param parser - The Redis command parser
     * @param count - Optional maximum number of entries to return
     */
    readonly parseCommand: (this: void, parser: CommandParser, count?: number) => void;
    readonly transformReply: {
        readonly 2: (reply: UnwrapReply<Resp2Reply<AclLogReply>>, preserve?: any, typeMapping?: TypeMapping) => {
            count: NumberReply<number>;
            reason: BlobStringReply<string>;
            context: BlobStringReply<string>;
            object: BlobStringReply<string>;
            username: BlobStringReply<string>;
            'age-seconds': DoubleReply<number>;
            'client-info': BlobStringReply<string>;
            'entry-id': NumberReply<number>;
            'timestamp-created': NumberReply<number>;
            'timestamp-last-updated': NumberReply<number>;
        }[];
        readonly 3: () => AclLogReply;
    };
};
export default _default;
//# sourceMappingURL=ACL_LOG.d.ts.map