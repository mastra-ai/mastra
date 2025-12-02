import COMMANDS from '../commands';
import { MULTI_REPLY, MultiReply, MultiReplyType, RedisMultiQueuedCommand } from '../multi-command';
import { ReplyWithTypeMapping, CommandReply, Command, CommandArguments, CommanderConfig, RedisFunctions, RedisModules, RedisScripts, RespVersions, TransformReply, TypeMapping, RedisArgument } from '../RESP/types';
import { Tail } from '../commands/generic-transformers';
type CommandSignature<REPLIES extends Array<unknown>, C extends Command, M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = (...args: Tail<Parameters<C['parseCommand']>>) => RedisClusterMultiCommandType<[
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
export type RedisClusterMultiCommandType<REPLIES extends Array<any>, M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions, TYPE_MAPPING extends TypeMapping> = (RedisClusterMultiCommand<REPLIES> & WithCommands<REPLIES, M, F, S, RESP, TYPE_MAPPING> & WithModules<REPLIES, M, F, S, RESP, TYPE_MAPPING> & WithFunctions<REPLIES, M, F, S, RESP, TYPE_MAPPING> & WithScripts<REPLIES, M, F, S, RESP, TYPE_MAPPING>);
export type ClusterMultiExecute = (firstKey: RedisArgument | undefined, isReadonly: boolean | undefined, commands: Array<RedisMultiQueuedCommand>) => Promise<Array<unknown>>;
export default class RedisClusterMultiCommand<REPLIES = []> {
    #private;
    static extend<M extends RedisModules = Record<string, never>, F extends RedisFunctions = Record<string, never>, S extends RedisScripts = Record<string, never>, RESP extends RespVersions = 2>(config?: CommanderConfig<M, F, S, RESP>): any;
    constructor(executeMulti: ClusterMultiExecute, executePipeline: ClusterMultiExecute, routing: RedisArgument | undefined, typeMapping?: TypeMapping);
    addCommand(firstKey: RedisArgument | undefined, isReadonly: boolean | undefined, args: CommandArguments, transformReply?: TransformReply): this;
    exec<T extends MultiReply = MULTI_REPLY['GENERIC']>(execAsPipeline?: boolean): Promise<MultiReplyType<T, REPLIES>>;
    EXEC: <T extends MultiReply = "generic">(execAsPipeline?: boolean) => Promise<MultiReplyType<T, REPLIES>>;
    execTyped(execAsPipeline?: boolean): Promise<REPLIES>;
    execAsPipeline<T extends MultiReply = MULTI_REPLY['GENERIC']>(): Promise<MultiReplyType<T, REPLIES>>;
    execAsPipelineTyped(): Promise<REPLIES>;
}
export {};
//# sourceMappingURL=multi-command.d.ts.map