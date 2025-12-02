import { CommandParser } from '../client/parser';
import { RedisArgument, TuplesToMapReply, BlobStringReply, ArrayReply } from '../RESP/types';
type AclUser = TuplesToMapReply<[
    [
        BlobStringReply<'flags'>,
        ArrayReply<BlobStringReply>
    ],
    [
        BlobStringReply<'passwords'>,
        ArrayReply<BlobStringReply>
    ],
    [
        BlobStringReply<'commands'>,
        BlobStringReply
    ],
    /** changed to BlobStringReply in 7.0 */
    [
        BlobStringReply<'keys'>,
        ArrayReply<BlobStringReply> | BlobStringReply
    ],
    /** added in 6.2, changed to BlobStringReply in 7.0 */
    [
        BlobStringReply<'channels'>,
        ArrayReply<BlobStringReply> | BlobStringReply
    ],
    /** added in 7.0 */
    [
        BlobStringReply<'selectors'>,
        ArrayReply<TuplesToMapReply<[
            [
                BlobStringReply<'commands'>,
                BlobStringReply
            ],
            [
                BlobStringReply<'keys'>,
                BlobStringReply
            ],
            [
                BlobStringReply<'channels'>,
                BlobStringReply
            ]
        ]>>
    ]
]>;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns ACL information about a specific user
     * @param parser - The Redis command parser
     * @param username - Username to get information for
     */
    readonly parseCommand: (this: void, parser: CommandParser, username: RedisArgument) => void;
    readonly transformReply: {
        readonly 2: (reply: [BlobStringReply<"flags">, import("../RESP/types").RespType<42, BlobStringReply<string>[], never, BlobStringReply<string>[]>, BlobStringReply<"passwords">, import("../RESP/types").RespType<42, BlobStringReply<string>[], never, BlobStringReply<string>[]>, BlobStringReply<"commands">, BlobStringReply<string>, BlobStringReply<"keys">, BlobStringReply<string> | import("../RESP/types").RespType<42, BlobStringReply<string>[], never, BlobStringReply<string>[]>, BlobStringReply<"channels">, BlobStringReply<string> | import("../RESP/types").RespType<42, BlobStringReply<string>[], never, BlobStringReply<string>[]>, BlobStringReply<"selectors">, import("../RESP/types").RespType<42, import("../RESP/types").RespType<42, [BlobStringReply<"commands">, BlobStringReply<string>, BlobStringReply<"keys">, BlobStringReply<string>, BlobStringReply<"channels">, BlobStringReply<string>], never, [BlobStringReply<"commands">, BlobStringReply<string>, BlobStringReply<"keys">, BlobStringReply<string>, BlobStringReply<"channels">, BlobStringReply<string>]>[], never, import("../RESP/types").RespType<42, [BlobStringReply<"commands">, BlobStringReply<string>, BlobStringReply<"keys">, BlobStringReply<string>, BlobStringReply<"channels">, BlobStringReply<string>], never, [BlobStringReply<"commands">, BlobStringReply<string>, BlobStringReply<"keys">, BlobStringReply<string>, BlobStringReply<"channels">, BlobStringReply<string>]>[]>]) => {
            flags: import("../RESP/types").RespType<42, BlobStringReply<string>[], never, BlobStringReply<string>[]>;
            passwords: import("../RESP/types").RespType<42, BlobStringReply<string>[], never, BlobStringReply<string>[]>;
            commands: BlobStringReply<string>;
            keys: BlobStringReply<string> | import("../RESP/types").RespType<42, BlobStringReply<string>[], never, BlobStringReply<string>[]>;
            channels: BlobStringReply<string> | import("../RESP/types").RespType<42, BlobStringReply<string>[], never, BlobStringReply<string>[]>;
            selectors: {
                commands: BlobStringReply<string>;
                keys: BlobStringReply<string>;
                channels: BlobStringReply<string>;
            }[];
        };
        readonly 3: () => AclUser;
    };
};
export default _default;
//# sourceMappingURL=ACL_GETUSER.d.ts.map