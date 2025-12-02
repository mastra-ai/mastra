/// <reference types="node" />
import { RedisModules, RedisFunctions, RedisScripts, RespVersions, Command, CommandArguments, ReplyUnion } from '../RESP/types';
import { RedisClientType } from '.';
import { ErrorReply } from '../errors';
import COMMANDS from '../commands';
type LegacyArgument = string | Buffer | number | Date;
type LegacyArguments = Array<LegacyArgument | LegacyArguments>;
type LegacyCallback = (err: ErrorReply | null, reply?: ReplyUnion) => unknown;
type LegacyCommandArguments = LegacyArguments | [
    ...args: LegacyArguments,
    callback: LegacyCallback
];
type WithCommands = {
    [P in keyof typeof COMMANDS]: (...args: LegacyCommandArguments) => void;
};
export type RedisLegacyClientType = RedisLegacyClient & WithCommands;
export declare class RedisLegacyClient {
    #private;
    static pushArguments(redisArgs: CommandArguments, args: LegacyArguments): void;
    static getTransformReply(command: Command, resp: RespVersions): import("../RESP/types").TransformReply | undefined;
    constructor(client: RedisClientType<RedisModules, RedisFunctions, RedisScripts>);
    sendCommand(...args: LegacyCommandArguments): void;
    multi(): RedisLegacyMultiType;
}
type MultiWithCommands = {
    [P in keyof typeof COMMANDS]: (...args: LegacyCommandArguments) => RedisLegacyMultiType;
};
export type RedisLegacyMultiType = LegacyMultiCommand & MultiWithCommands;
declare class LegacyMultiCommand {
    #private;
    static factory(resp: RespVersions): (client: RedisClientType<RedisModules, RedisFunctions, RedisScripts>) => RedisLegacyMultiType;
    constructor(client: RedisClientType<RedisModules, RedisFunctions, RedisScripts>);
    sendCommand(...args: LegacyArguments): this;
    exec(cb?: (err: ErrorReply | null, replies?: Array<unknown>) => unknown): void;
}
export {};
//# sourceMappingURL=legacy-mode.d.ts.map