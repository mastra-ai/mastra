import { CommandParser } from '../client/parser';
import { TuplesToMapReply, BlobStringReply, SetReply, NumberReply, ArrayReply } from '../RESP/types';
type TrackingInfo = TuplesToMapReply<[
    [
        BlobStringReply<'flags'>,
        SetReply<BlobStringReply>
    ],
    [
        BlobStringReply<'redirect'>,
        NumberReply
    ],
    [
        BlobStringReply<'prefixes'>,
        ArrayReply<BlobStringReply>
    ]
]>;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns information about the current connection's key tracking state
     * @param parser - The Redis command parser
     */
    readonly parseCommand: (this: void, parser: CommandParser) => void;
    readonly transformReply: {
        readonly 2: (reply: [BlobStringReply<"flags">, import("../RESP/types").RespType<126, BlobStringReply<string>[], never, BlobStringReply<string>[]>, BlobStringReply<"redirect">, NumberReply<number>, BlobStringReply<"prefixes">, import("../RESP/types").RespType<42, BlobStringReply<string>[], never, BlobStringReply<string>[]>]) => {
            flags: import("../RESP/types").RespType<126, BlobStringReply<string>[], never, BlobStringReply<string>[]>;
            redirect: NumberReply<number>;
            prefixes: import("../RESP/types").RespType<42, BlobStringReply<string>[], never, BlobStringReply<string>[]>;
        };
        readonly 3: () => TrackingInfo;
    };
};
export default _default;
//# sourceMappingURL=CLIENT_TRACKINGINFO.d.ts.map