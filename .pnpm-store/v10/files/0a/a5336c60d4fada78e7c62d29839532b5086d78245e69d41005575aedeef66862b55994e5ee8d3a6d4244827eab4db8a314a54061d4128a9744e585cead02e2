import { CommandParser } from '../client/parser';
import { RedisArgument, RespVersions, TuplesToMapReply, BlobStringReply, NumberReply, ArrayReply } from '../RESP/types';
export interface HelloOptions {
    protover?: RespVersions;
    AUTH?: {
        username: RedisArgument;
        password: RedisArgument;
    };
    SETNAME?: string;
}
export type HelloReply = TuplesToMapReply<[
    [
        BlobStringReply<'server'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'version'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'proto'>,
        NumberReply<RespVersions>
    ],
    [
        BlobStringReply<'id'>,
        NumberReply
    ],
    [
        BlobStringReply<'mode'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'role'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'modules'>,
        ArrayReply<BlobStringReply>
    ]
]>;
declare const _default: {
    /**
     * Handshakes with the Redis server and switches to the specified protocol version
     * @param parser - The Redis command parser
     * @param protover - Protocol version to use
     * @param options - Additional options for authentication and connection naming
     */
    readonly parseCommand: (this: void, parser: CommandParser, protover?: RespVersions, options?: HelloOptions) => void;
    readonly transformReply: {
        readonly 2: (reply: [BlobStringReply<"server">, BlobStringReply<string>, BlobStringReply<"version">, BlobStringReply<string>, BlobStringReply<"proto">, NumberReply<RespVersions>, BlobStringReply<"id">, NumberReply<number>, BlobStringReply<"mode">, BlobStringReply<string>, BlobStringReply<"role">, BlobStringReply<string>, BlobStringReply<"modules">, import("../RESP/types").RespType<42, BlobStringReply<string>[], never, BlobStringReply<string>[]>]) => {
            server: BlobStringReply<string>;
            version: BlobStringReply<string>;
            proto: NumberReply<RespVersions>;
            id: NumberReply<number>;
            mode: BlobStringReply<string>;
            role: BlobStringReply<string>;
            modules: import("../RESP/types").RespType<42, BlobStringReply<string>[], never, BlobStringReply<string>[]>;
        };
        readonly 3: () => HelloReply;
    };
};
export default _default;
//# sourceMappingURL=HELLO.d.ts.map