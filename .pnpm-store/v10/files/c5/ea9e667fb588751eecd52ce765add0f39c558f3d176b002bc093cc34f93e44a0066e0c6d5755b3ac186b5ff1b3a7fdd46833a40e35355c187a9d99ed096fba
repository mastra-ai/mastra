import COMMANDS from '../commands';
import { MULTI_MODE, MULTI_REPLY, MultiMode, MultiReply, MultiReplyType, RedisMultiQueuedCommand } from '../multi-command';
import { ReplyWithTypeMapping, CommandReply, Command, CommandArguments, CommanderConfig, RedisFunctions, RedisModules, RedisScripts, RespVersions, TransformReply, TypeMapping } from '../RESP/types';
import { Tail } from '../commands/generic-transformers';
type CommandSignature<REPLIES extends Array<unknown>, C extends Command, M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = (...args: Tail<Parameters<C['parseCommand']>>) => InternalRedisClientMultiCommandType<[
    ...REPLIES,
    ReplyWithTypeMapping<CommandReply<C, RESP>, TYPE_MAPPING>
], M, F, S, RESP, TYPE_MAPPING>;
type WithCommands<REPLIES extends Array<unknown>, M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = {
    [P in keyof typeof COMMANDS]: CommandSignature<REPLIES, (typeof COMMANDS)[P], M, F, S, RESP, TYPE_MAPPING>;
};
type WithModules<REPLIES extends Array<unknown>, M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = {
    [P in keyof M]: {
        [C in keyof M[P]]: CommandSignature<REPLIES, M[P][C], M, F, S, RESP, TYPE_MAPPING>;
    };
};
type WithFunctions<REPLIES extends Array<unknown>, M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = {
    [L in keyof F]: {
        [C in keyof F[L]]: CommandSignature<REPLIES, F[L][C], M, F, S, RESP, TYPE_MAPPING>;
    };
};
type WithScripts<REPLIES extends Array<unknown>, M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = {
    [P in keyof S]: CommandSignature<REPLIES, S[P], M, F, S, RESP, TYPE_MAPPING>;
};
type InternalRedisClientMultiCommandType<REPLIES extends Array<any>, M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = (RedisClientMultiCommand<REPLIES> & WithCommands<REPLIES, M, F, S, RESP, TYPE_MAPPING> & WithModules<REPLIES, M, F, S, RESP, TYPE_MAPPING> & WithFunctions<REPLIES, M, F, S, RESP, TYPE_MAPPING> & WithScripts<REPLIES, M, F, S, RESP, TYPE_MAPPING>);
type TypedOrAny<Flag extends MultiMode, T> = [
    Flag
] extends [MULTI_MODE['TYPED']] ? T : any;
export type RedisClientMultiCommandType<isTyped extends MultiMode, REPLIES extends Array<any>, M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = TypedOrAny<isTyped, InternalRedisClientMultiCommandType<REPLIES, M, F, S, RESP, TYPE_MAPPING>>;
type ExecuteMulti = (commands: Array<RedisMultiQueuedCommand>, selectedDB?: number) => Promise<Array<unknown>>;
export default class RedisClientMultiCommand<REPLIES = []> {
    #private;
    static extend<M extends RedisModules = Record<string, never>, F extends RedisFunctions = Record<string, never>, S extends RedisScripts = Record<string, never>, RESP extends RespVersions = 2>(config?: CommanderConfig<M, F, S, RESP>): any;
    constructor(executeMulti: ExecuteMulti, executePipeline: ExecuteMulti, typeMapping?: TypeMapping);
    SELECT(db: number, transformReply?: TransformReply): this;
    select: (db: number, transformReply?: TransformReply) => this;
    addCommand(args: CommandArguments, transformReply?: TransformReply): this;
    exec<T extends MultiReply = MULTI_REPLY['GENERIC']>(execAsPipeline?: boolean): Promise<MultiReplyType<T, REPLIES>>;
    EXEC: <T extends MultiReply = "generic">(execAsPipeline?: boolean) => Promise<MultiReplyType<T, REPLIES>>;
    execTyped(execAsPipeline?: boolean): Promise<REPLIES>;
    execAsPipeline<T extends MultiReply = MULTI_REPLY['GENERIC']>(): Promise<MultiReplyType<T, REPLIES>>;
    execAsPipelineTyped(): Promise<REPLIES>;
}
export {};
//# sourceMappingURL=multi-command.d.ts.map