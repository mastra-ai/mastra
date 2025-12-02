/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2019-present MagicStack Inc. and the Gel authors.
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
import type { ICodec } from "./codecs/ifaces";
import type { CodecsRegistry } from "./codecs/registry";
import * as errors from "./errors";
import type { QueryOptions, ProtocolVersion, QueryArgs } from "./ifaces";
import { Cardinality, OutputFormat, Language } from "./ifaces";
import { ReadMessageBuffer, WriteBuffer } from "./primitives/buffer";
import Event from "./primitives/event";
import LRU from "./primitives/lru";
import type { SerializedSessionState } from "./options";
import { Options } from "./options";
export declare const PROTO_VER: ProtocolVersion;
export declare const PROTO_VER_MIN: ProtocolVersion;
export declare enum Capabilities {
    NONE = 0,
    MODIFICATONS = 1,
    SESSION_CONFIG = 2,
    TRANSACTION = 4,
    DDL = 8,
    PERSISTENT_CONFIG = 16,
    SET_GLOBAL = 32,
    ALL = 4294967295
}
export declare const RESTRICTED_CAPABILITIES: number;
export type ParseResult = [
    cardinality: Cardinality,
    inCodec: ICodec,
    outCodec: ICodec,
    capabilities: number,
    inCodecBuffer: Uint8Array | null,
    outCodecBuffer: Uint8Array | null,
    warnings: errors.GelError[],
    unsafeIsolationDangers: errors.GelError[]
];
export type connConstructor = new (registry: CodecsRegistry) => BaseRawConnection;
export declare class BaseRawConnection {
    protected connected: boolean;
    protected lastStatus: string | null;
    protected codecsRegistry: CodecsRegistry;
    protected queryCodecCache: LRU<string, [
        number,
        ICodec,
        ICodec,
        number,
        errors.GelError[]
    ]>;
    protected serverSecret: Uint8Array | null;
    private serverXactStatus;
    protected buffer: ReadMessageBuffer;
    protected messageWaiter: Event | null;
    protected connWaiter: Event;
    connAbortWaiter: Event;
    protected _abortedWith: Error | null;
    protocolVersion: ProtocolVersion;
    protected stateCodec: ICodec;
    protected stateCache: WeakMap<Options, Uint8Array>;
    lastStateUpdate: SerializedSessionState | null;
    protected adminUIMode: boolean;
    protected throwNotImplemented(method: string): never;
    protected _waitForMessage(): Promise<void>;
    protected _sendData(_data: Uint8Array): void;
    getConnAbortError(): Error;
    protected _checkState(): void;
    protected _abortWithError(err: Error): void;
    protected _ignoreHeaders(): void;
    protected _readHeaders(): Record<string, string>;
    protected _abortWaiters(err: Error): void;
    protected _parseHeaders(): Map<number, Uint8Array>;
    private _parseDescribeTypeMessage;
    protected _parseCommandCompleteMessage(): string;
    protected _parseErrorMessage(): Error;
    protected _parseSyncMessage(): void;
    private _redirectDataMessages;
    private _parseDataMessages;
    private _parseServerSettings;
    protected _parseDescribeStateMessage(): void;
    protected _fallthrough(): void;
    private _encodeArgs;
    private _isInTransaction;
    private _setStateCodec;
    private _encodeParseParams;
    _parse(language: Language, query: string, outputFormat: OutputFormat, expectedCardinality: Cardinality, state: Options, capabilitiesFlags?: number, options?: QueryOptions, unsafeIsolationDangers?: errors.GelError[]): Promise<ParseResult>;
    protected _executeFlow(language: Language, query: string, args: QueryArgs, outputFormat: OutputFormat, expectedCardinality: Cardinality, state: Options, inCodec: ICodec, outCodec: ICodec, result: any[] | WriteBuffer, capabilitiesFlags?: number, options?: QueryOptions, unsafeIsolationDangers?: errors.GelError[]): Promise<[errors.GelError[], errors.GelError[]]>;
    private _getQueryCacheKey;
    private _validateFetchCardinality;
    fetch(query: string, args: QueryArgs | undefined, outputFormat: OutputFormat, expectedCardinality: Cardinality, state: Options, privilegedMode?: boolean, language?: Language): Promise<{
        result: any;
        warnings: errors.GelError[];
        unsafeIsolationDangers: errors.GelError[];
    }>;
    getQueryCapabilities(query: string, outputFormat: OutputFormat, expectedCardinality: Cardinality): number | null;
    resetState(): Promise<void>;
    protected _abort(): void;
    isClosed(): boolean;
    close(): Promise<void>;
}
