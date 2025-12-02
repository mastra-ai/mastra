import { CommandParser } from '../client/parser';
import { BlobStringReply, NumberReply, ArrayReply, TuplesReply, UnwrapReply } from '../RESP/types';
/**
 * Role information returned for a Redis master
 */
type MasterRole = [
    role: BlobStringReply<'master'>,
    replicationOffest: NumberReply,
    replicas: ArrayReply<TuplesReply<[host: BlobStringReply, port: BlobStringReply, replicationOffest: BlobStringReply]>>
];
/**
 * Role information returned for a Redis slave
 */
type SlaveRole = [
    role: BlobStringReply<'slave'>,
    masterHost: BlobStringReply,
    masterPort: NumberReply,
    state: BlobStringReply<'connect' | 'connecting' | 'sync' | 'connected'>,
    dataReceived: NumberReply
];
/**
 * Role information returned for a Redis sentinel
 */
type SentinelRole = [
    role: BlobStringReply<'sentinel'>,
    masterNames: ArrayReply<BlobStringReply>
];
/**
 * Combined role type for Redis instance role information
 */
type Role = TuplesReply<MasterRole | SlaveRole | SentinelRole>;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the ROLE command
     *
     * @param parser - The command parser
     * @see https://redis.io/commands/role/
     */
    readonly parseCommand: (this: void, parser: CommandParser) => void;
    /**
     * Transforms the ROLE reply into a structured object
     *
     * @param reply - The raw reply from Redis
     * @returns Structured object representing role information
     */
    readonly transformReply: (this: void, reply: UnwrapReply<Role>) => {
        role: BlobStringReply<"master">;
        replicationOffest: NumberReply<number>;
        replicas: {
            host: BlobStringReply<string>;
            port: number;
            replicationOffest: number;
        }[];
        master?: undefined;
        state?: undefined;
        dataReceived?: undefined;
        masterNames?: undefined;
    } | {
        role: BlobStringReply<"slave">;
        master: {
            host: BlobStringReply<string>;
            port: NumberReply<number>;
        };
        state: BlobStringReply<"connect" | "connecting" | "sync" | "connected">;
        dataReceived: NumberReply<number>;
        replicationOffest?: undefined;
        replicas?: undefined;
        masterNames?: undefined;
    } | {
        role: BlobStringReply<"sentinel">;
        masterNames: ArrayReply<BlobStringReply<string>>;
        replicationOffest?: undefined;
        replicas?: undefined;
        master?: undefined;
        state?: undefined;
        dataReceived?: undefined;
    } | undefined;
};
export default _default;
//# sourceMappingURL=ROLE.d.ts.map