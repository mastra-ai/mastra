/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2020-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { Codecs } from "./codecs/codecs";
import type { ConnectArgumentsParser, ConnectConfig, ResolvedConnectConfigReadonly } from "./conUtils";
import { type Executor, type QueryArgs, type SQLQueryArgs } from "./ifaces";
import type { RetryOptions, SimpleConfig, SimpleRetryOptions, SimpleTransactionOptions, TransactionOptions, WarningHandler } from "./options";
import { Options } from "./options";
import type { BaseRawConnection } from "./baseConn";
import type { ConnectWithTimeout } from "./retry";
import { Transaction } from "./transaction";
export declare class ClientConnectionHolder {
    private _pool;
    private _connection;
    private _options;
    private _inUse;
    constructor(pool: BaseClientPool);
    get options(): Options;
    _getConnection(): Promise<BaseRawConnection>;
    get connectionOpen(): boolean;
    acquire(options: Options): Promise<ClientConnectionHolder>;
    release(): Promise<void>;
    terminate(): void;
    transaction<T>(action: (transaction: Transaction) => Promise<T>): Promise<T>;
    private retryingFetch;
    execute(query: string, args?: QueryArgs): Promise<void>;
    executeSQL(query: string, args?: SQLQueryArgs): Promise<void>;
    query(query: string, args?: QueryArgs): Promise<any>;
    querySQL(query: string, args?: SQLQueryArgs): Promise<any>;
    queryJSON(query: string, args?: QueryArgs): Promise<string>;
    querySingle(query: string, args?: QueryArgs): Promise<any>;
    querySingleJSON(query: string, args?: QueryArgs): Promise<string>;
    queryRequired(query: string, args?: QueryArgs): Promise<any>;
    queryRequiredJSON(query: string, args?: QueryArgs): Promise<string>;
    queryRequiredSingle(query: string, args?: QueryArgs): Promise<any>;
    queryRequiredSingleJSON(query: string, args?: QueryArgs): Promise<string>;
}
export declare abstract class BaseClientPool {
    private _parseConnectArguments;
    protected abstract _connectWithTimeout: ConnectWithTimeout;
    abstract isStateless: boolean;
    private _closing;
    private _queue;
    private _holders;
    private _userConcurrency;
    private _suggestedConcurrency;
    private _connectConfig;
    private _codecsRegistry;
    constructor(_parseConnectArguments: ConnectArgumentsParser, options: ConnectOptions);
    private validateClientOptions;
    _getStats(): {
        openConnections: number;
        queueLength: number;
    };
    ensureConnected(): Promise<void>;
    private get _concurrency();
    private _resizeHolderPool;
    private __normalizedConnectConfig;
    private _getNormalizedConnectConfig;
    resolveConnectionParams(): Promise<ResolvedConnectConfigReadonly>;
    getNewConnection(): Promise<BaseRawConnection>;
    acquireHolder(options: Options): Promise<ClientConnectionHolder>;
    enqueue(holder: ClientConnectionHolder): void;
    close(): Promise<void>;
    private _terminate;
    terminate(): void;
    isClosed(): boolean;
}
export interface ClientOptions {
    concurrency?: number;
}
export type ConnectOptions = ConnectConfig & ClientOptions;
export declare class Client implements Executor {
    private pool;
    private options;
    withTransactionOptions(opts: TransactionOptions | SimpleTransactionOptions): Client;
    withRetryOptions(opts: RetryOptions | SimpleRetryOptions): Client;
    withModuleAliases(aliases: Record<string, string>): Client;
    withConfig(config: SimpleConfig): Client;
    withCodecs(codecs: Codecs.CodecSpec): Client;
    withSQLRowMode(mode: "array" | "object"): Client;
    withGlobals(globals: Record<string, any>): Client;
    withQueryTag(tag: string | null): Client;
    withWarningHandler(handler: WarningHandler): Client;
    ensureConnected(): Promise<this>;
    resolveConnectionParams(): Promise<ResolvedConnectConfigReadonly>;
    isClosed(): boolean;
    close(): Promise<void>;
    terminate(): void;
    transaction<T>(action: (transaction: Transaction) => Promise<T>): Promise<T>;
    execute(query: string, args?: QueryArgs): Promise<void>;
    executeSQL(query: string, args?: SQLQueryArgs): Promise<void>;
    query<T = unknown>(query: string, args?: QueryArgs): Promise<T[]>;
    querySQL<T = unknown>(query: string, args?: SQLQueryArgs): Promise<T[]>;
    queryJSON(query: string, args?: QueryArgs): Promise<string>;
    querySingle<T = unknown>(query: string, args?: QueryArgs): Promise<T | null>;
    querySingleJSON(query: string, args?: QueryArgs): Promise<string>;
    queryRequired<T = unknown>(query: string, args?: QueryArgs): Promise<[T, ...T[]]>;
    queryRequiredJSON(query: string, args?: QueryArgs): Promise<string>;
    queryRequiredSingle<T = unknown>(query: string, args?: QueryArgs): Promise<T>;
    queryRequiredSingleJSON(query: string, args?: QueryArgs): Promise<string>;
    describe(query: string): Promise<{
        in: import("./codecs/ifaces").ICodec;
        out: import("./codecs/ifaces").ICodec;
        cardinality: import("./reflection").Cardinality;
        capabilities: number;
    }>;
    parse(query: string): Promise<{
        in: import("./codecs/ifaces").ICodec;
        out: import("./codecs/ifaces").ICodec;
        cardinality: import("./reflection").Cardinality;
        capabilities: number;
    }>;
}
