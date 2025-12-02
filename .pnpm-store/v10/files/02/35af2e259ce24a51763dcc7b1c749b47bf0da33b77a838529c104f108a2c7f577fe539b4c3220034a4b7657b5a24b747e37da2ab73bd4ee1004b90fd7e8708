/*!
 * @module common/operation
 */
import { MetadataCallback, ServiceObject, ServiceObjectConfig } from './service-object';
export declare class Operation<T = any> extends ServiceObject<T> {
    completeListeners: number;
    hasActiveListeners: boolean;
    /**
     * An Operation object allows you to interact with APIs that take longer to
     * process things.
     *
     * @constructor
     * @alias module:common/operation
     *
     * @param {object} config - Configuration object.
     * @param {module:common/service|module:common/serviceObject|module:common/grpcService|module:common/grpcServiceObject} config.parent - The parent object.
     */
    constructor(config: ServiceObjectConfig);
    /**
     * Wraps the `complete` and `error` events in a Promise.
     *
     * @return {Promise}
     */
    promise(): Promise<unknown>;
    /**
     * Begin listening for events on the operation. This method keeps track of how
     * many "complete" listeners are registered and removed, making sure polling
     * is handled automatically.
     *
     * As long as there is one active "complete" listener, the connection is open.
     * When there are no more listeners, the polling stops.
     *
     * @private
     */
    protected listenForEvents_(): void;
    /**
     * Poll for a status update. Returns null for an incomplete
     * status, and metadata for a complete status.
     *
     * @private
     */
    protected poll_(callback: MetadataCallback): void;
    /**
     * Poll `getMetadata` to check the operation's status. This runs a loop to
     * ping the API on an interval.
     *
     * Note: This method is automatically called once a "complete" event handler
     * is registered on the operation.
     *
     * @private
     */
    protected startPolling_(): Promise<void>;
}
