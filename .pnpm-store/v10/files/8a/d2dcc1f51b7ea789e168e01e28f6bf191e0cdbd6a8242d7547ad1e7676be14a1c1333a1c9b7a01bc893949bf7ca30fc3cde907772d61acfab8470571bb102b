import { ArrayReply, Command, RedisFunction, RedisScript, RespVersions, UnwrapReply } from '../RESP/types';
import { RedisSocketOptions } from '../client/socket';
import { NamespaceProxySentinel, NamespaceProxySentinelClient, ProxySentinel, ProxySentinelClient, RedisNode } from './types';
export declare function parseNode(node: Record<string, string>): RedisNode | undefined;
export declare function createNodeList(nodes: UnwrapReply<ArrayReply<Record<string, string>>>): RedisNode[];
export declare function clientSocketToNode(socket: RedisSocketOptions): RedisNode;
export declare function createCommand<T extends ProxySentinel | ProxySentinelClient>(command: Command, resp: RespVersions): (this: T, ...args: Array<unknown>) => Promise<any>;
export declare function createFunctionCommand<T extends NamespaceProxySentinel | NamespaceProxySentinelClient>(name: string, fn: RedisFunction, resp: RespVersions): (this: T, ...args: Array<unknown>) => Promise<any>;
export declare function createModuleCommand<T extends NamespaceProxySentinel | NamespaceProxySentinelClient>(command: Command, resp: RespVersions): (this: T, ...args: Array<unknown>) => Promise<any>;
export declare function createScriptCommand<T extends ProxySentinel | ProxySentinelClient>(script: RedisScript, resp: RespVersions): (this: T, ...args: Array<unknown>) => Promise<any>;
//# sourceMappingURL=utils.d.ts.map