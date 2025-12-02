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
import type { ResolvedConnectConfigReadonly } from "./conUtils";
import type { HttpSCRAMAuth } from "./httpScram";
import type { ProtocolVersion } from "./ifaces";
export { Float16Array, getFloat16, isFloat16Array, setFloat16, } from "@petamoriken/float16";
export declare function getUniqueId(prefix?: string): string;
export declare function sleep(durationMillis: number): Promise<void>;
export declare function versionEqual(left: ProtocolVersion, right: ProtocolVersion): boolean;
export declare function versionGreaterThan(left: ProtocolVersion, right: ProtocolVersion): boolean;
export declare function versionGreaterThanOrEqual(left: ProtocolVersion, right: ProtocolVersion): boolean;
export interface CryptoUtils {
    makeKey: (key: Uint8Array) => Promise<Uint8Array | CryptoKey>;
    randomBytes: (size: number) => Uint8Array;
    H: (msg: Uint8Array) => Promise<Uint8Array>;
    HMAC: (key: Uint8Array | CryptoKey, msg: Uint8Array) => Promise<Uint8Array>;
}
export type AuthenticatedFetch = (path: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export declare function getAuthenticatedFetch(config: ResolvedConnectConfigReadonly, httpSCRAMAuth: HttpSCRAMAuth, basePath?: string): Promise<AuthenticatedFetch>;
