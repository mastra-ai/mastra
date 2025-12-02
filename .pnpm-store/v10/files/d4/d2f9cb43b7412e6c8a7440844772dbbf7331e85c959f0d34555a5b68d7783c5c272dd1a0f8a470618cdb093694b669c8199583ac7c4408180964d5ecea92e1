/// <reference types="node" />
import { Command, CommanderConfig, RedisArgument, RedisCommands, RedisFunction, RedisFunctions, RedisModules, RedisScript, RedisScripts, RespVersions, TransformReply } from './RESP/types';
interface AttachConfigOptions<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions> {
    BaseClass: new (...args: any) => any;
    commands: RedisCommands;
    createCommand(command: Command, resp: RespVersions): (...args: any) => any;
    createModuleCommand(command: Command, resp: RespVersions): (...args: any) => any;
    createFunctionCommand(name: string, fn: RedisFunction, resp: RespVersions): (...args: any) => any;
    createScriptCommand(script: RedisScript, resp: RespVersions): (...args: any) => any;
    config?: CommanderConfig<M, F, S, RESP>;
}
export declare function attachConfig<M extends RedisModules, F extends RedisFunctions, S extends RedisScripts, RESP extends RespVersions>({ BaseClass, commands, createCommand, createModuleCommand, createFunctionCommand, createScriptCommand, config }: AttachConfigOptions<M, F, S, RESP>): any;
export declare function getTransformReply(command: Command, resp: RespVersions): TransformReply | undefined;
export declare function functionArgumentsPrefix(name: string, fn: RedisFunction): RedisArgument[];
export declare function scriptArgumentsPrefix(script: RedisScript): (string | Buffer)[];
export {};
//# sourceMappingURL=commander.d.ts.map