/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { EmulatorMockTokenOptions } from '@firebase/util';
export interface RepoInfoEmulatorOptions {
    mockUserToken?: string | EmulatorMockTokenOptions;
}
/**
 * A class that holds metadata about a Repo object
 */
export declare class RepoInfo {
    readonly secure: boolean;
    readonly namespace: string;
    readonly webSocketOnly: boolean;
    readonly nodeAdmin: boolean;
    readonly persistenceKey: string;
    readonly includeNamespaceInQueryParams: boolean;
    readonly isUsingEmulator: boolean;
    readonly emulatorOptions: RepoInfoEmulatorOptions | null;
    private _host;
    private _domain;
    internalHost: string;
    /**
     * @param host - Hostname portion of the url for the repo
     * @param secure - Whether or not this repo is accessed over ssl
     * @param namespace - The namespace represented by the repo
     * @param webSocketOnly - Whether to prefer websockets over all other transports (used by Nest).
     * @param nodeAdmin - Whether this instance uses Admin SDK credentials
     * @param persistenceKey - Override the default session persistence storage key
     */
    constructor(host: string, secure: boolean, namespace: string, webSocketOnly: boolean, nodeAdmin?: boolean, persistenceKey?: string, includeNamespaceInQueryParams?: boolean, isUsingEmulator?: boolean, emulatorOptions?: RepoInfoEmulatorOptions | null);
    isCacheableHost(): boolean;
    isCustomHost(): boolean;
    get host(): string;
    set host(newHost: string);
    toString(): string;
    toURLString(): string;
}
/**
 * Returns the websocket URL for this repo
 * @param repoInfo - RepoInfo object
 * @param type - of connection
 * @param params - list
 * @returns The URL for this repo
 */
export declare function repoInfoConnectionURL(repoInfo: RepoInfo, type: string, params: {
    [k: string]: string;
}): string;
