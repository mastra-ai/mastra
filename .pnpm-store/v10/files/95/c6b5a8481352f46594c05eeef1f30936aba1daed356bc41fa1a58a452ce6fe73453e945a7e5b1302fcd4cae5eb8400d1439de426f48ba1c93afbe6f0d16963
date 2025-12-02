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
import { RepoInfo } from '../core/RepoInfo';
import { BrowserPollConnection } from './BrowserPollConnection';
import { TransportConstructor } from './Transport';
import { WebSocketConnection } from './WebSocketConnection';
/**
 * Currently simplistic, this class manages what transport a Connection should use at various stages of its
 * lifecycle.
 *
 * It starts with longpolling in a browser, and httppolling on node. It then upgrades to websockets if
 * they are available.
 */
export declare class TransportManager {
    private transports_;
    static globalTransportInitialized_: boolean;
    static get ALL_TRANSPORTS(): (typeof BrowserPollConnection | typeof WebSocketConnection)[];
    /**
     * Returns whether transport has been selected to ensure WebSocketConnection or BrowserPollConnection are not called after
     * TransportManager has already set up transports_
     */
    static get IS_TRANSPORT_INITIALIZED(): boolean;
    /**
     * @param repoInfo - Metadata around the namespace we're connecting to
     */
    constructor(repoInfo: RepoInfo);
    private initTransports_;
    /**
     * @returns The constructor for the initial transport to use
     */
    initialTransport(): TransportConstructor;
    /**
     * @returns The constructor for the next transport, or null
     */
    upgradeTransport(): TransportConstructor | null;
}
