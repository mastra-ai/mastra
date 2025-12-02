/*!
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export declare const CLIENT_TERMINATED_ERROR_MSG = "The client has already been terminated";
/**
 * An auto-resizing pool that distributes concurrent operations over multiple
 * clients of type `T`.
 *
 * ClientPool is used within Firestore to manage a pool of GAPIC clients and
 * automatically initializes multiple clients if we issue more than 100
 * concurrent operations.
 *
 * @private
 * @internal
 */
export declare class ClientPool<T extends object> {
    private readonly concurrentOperationLimit;
    private readonly maxIdleClients;
    private readonly clientFactory;
    private readonly clientDestructor;
    private grpcEnabled;
    /**
     * Stores each active clients and how many operations it has outstanding.
     */
    private readonly activeClients;
    /**
     * A set of clients that have seen RST_STREAM errors (see
     * https://github.com/googleapis/nodejs-firestore/issues/1023) and should
     * no longer be used.
     */
    private readonly failedClients;
    /**
     * A mapping from "client" objects to their corresponding IDs. These IDs have
     * no semantic meaning but are used for logging to enable tracing the events
     * of a particular client over time (such as creating, acquiring, and
     * releasing).
     */
    private readonly clientIdByClient;
    /**
     * An object that can be specified to `logger()` to lazily calculate a long
     * log message that includes all client IDs of active and pending clients.
     */
    private readonly lazyLogStringForAllClientIds;
    /**
     * Whether the Firestore instance has been terminated. Once terminated, the
     * ClientPool can longer schedule new operations.
     */
    private terminated;
    /**
     * Deferred promise that is resolved when there are no active operations on
     * the client pool after terminate() has been called.
     */
    private readonly terminateDeferred;
    /**
     * A unique identifier for this object, for inclusion in log messages.
     */
    private readonly instanceId;
    /**
     * @param concurrentOperationLimit The number of operations that each client
     * can handle.
     * @param maxIdleClients The maximum number of idle clients to keep before
     * garbage collecting.
     * @param clientFactory A factory function called as needed when new clients
     * are required.
     * @param clientDestructor A cleanup function that is called when a client is
     * disposed of.
     */
    constructor(concurrentOperationLimit: number, maxIdleClients: number, clientFactory: (requiresGrpc: boolean) => T, clientDestructor?: (client: T) => Promise<void>);
    /**
     * Returns an already existing client if it has less than the maximum number
     * of concurrent operations or initializes and returns a new client.
     *
     * @private
     * @internal
     */
    private acquire;
    /**
     * Reduces the number of operations for the provided client, potentially
     * removing it from the pool of active clients.
     * @private
     * @internal
     */
    private release;
    /**
     * Given the current operation counts, determines if the given client should
     * be garbage collected.
     * @private
     * @internal
     */
    private shouldGarbageCollectClient;
    /**
     * The number of currently registered clients.
     *
     * @return Number of currently registered clients.
     * @private
     * @internal
     */
    get size(): number;
    /**
     * The number of currently active operations.
     *
     * @return Number of currently active operations.
     * @private
     * @internal
     */
    get opCount(): number;
    /**
     * The currently active clients.
     *
     * @return The currently active clients.
     * @private
     * @internal
     */
    get _activeClients(): Map<T, {
        activeRequestCount: number;
        grpcEnabled: boolean;
    }>;
    /**
     * Runs the provided operation in this pool. This function may create an
     * additional client if all existing clients already operate at the concurrent
     * operation limit.
     *
     * @param requestTag A unique client-assigned identifier for this operation.
     * @param op A callback function that returns a Promise. The client T will
     * be returned to the pool when callback finishes.
     * @return A Promise that resolves with the result of `op`.
     * @private
     * @internal
     */
    run<V>(requestTag: string, requiresGrpc: boolean, op: (client: T) => Promise<V>): Promise<V>;
    terminate(): Promise<void>;
}
