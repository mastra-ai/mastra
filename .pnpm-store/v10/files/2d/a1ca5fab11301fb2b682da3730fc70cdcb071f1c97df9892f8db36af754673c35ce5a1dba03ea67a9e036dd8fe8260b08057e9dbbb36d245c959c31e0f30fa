/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2022-present MagicStack Inc. and the Gel authors.
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
import { BaseRawConnection, type ParseResult } from "./baseConn";
import type { ICodec } from "./codecs/ifaces";
import type { CodecsRegistry } from "./codecs/registry";
import type { NormalizedConnectConfig } from "./conUtils";
import { type GelError } from "./errors";
import type { HttpSCRAMAuth } from "./httpScram";
import { type Language, type ProtocolVersion, type QueryArgs, type QueryOptions } from "./ifaces";
import type { Options } from "./options";
import { type AuthenticatedFetch } from "./utils";
declare class BaseFetchConnection extends BaseRawConnection {
    protected authenticatedFetch: AuthenticatedFetch;
    protected abortSignal: AbortSignal | null;
    constructor(fetch: AuthenticatedFetch, registry: CodecsRegistry);
    protected _waitForMessage(): Promise<void>;
    protected __sendData(data: Uint8Array): Promise<void>;
    protected _sendData(data: Uint8Array): void;
    fetch(...args: Parameters<BaseRawConnection["fetch"]>): Promise<{
        result: any;
        warnings: GelError[];
        unsafeIsolationDangers: GelError[];
    }>;
    static create<T extends typeof BaseFetchConnection>(this: T, fetch: AuthenticatedFetch, registry: CodecsRegistry): InstanceType<T>;
}
export declare class AdminUIFetchConnection extends BaseFetchConnection {
    adminUIMode: boolean;
    static create<T extends typeof BaseFetchConnection>(this: T, fetch: AuthenticatedFetch, registry: CodecsRegistry, knownServerVersion?: [number, number]): InstanceType<T>;
    rawParse(language: Language, query: string, state: Options, options?: QueryOptions, abortSignal?: AbortSignal | null): Promise<[ProtocolVersion, ...ParseResult]>;
    rawExecute(language: Language, query: string, state: Options, outCodec?: ICodec, options?: QueryOptions, inCodec?: ICodec, args?: QueryArgs, abortSignal?: AbortSignal | null): Promise<[Uint8Array, GelError[]]>;
}
export declare class FetchConnection extends BaseFetchConnection {
    static createConnectWithTimeout(httpSCRAMAuth: HttpSCRAMAuth): (config: NormalizedConnectConfig, registry: CodecsRegistry) => Promise<FetchConnection>;
}
export {};
