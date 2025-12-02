/*! firebase-admin v13.5.0 */
import { App } from '../app/index';
import { InstanceId as TInstanceId } from './instance-id';
/**
 * Gets the {@link firebase-admin.instance-id#InstanceId} service for the
 * default app or a given app.
 *
 * `admin.instanceId()` can be called with no arguments to access the default
 * app's `InstanceId` service or as `admin.instanceId(app)` to access the
 * `InstanceId` service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the Instance ID service for the default app
 * var defaultInstanceId = admin.instanceId();
 * ```
 *
 * @example
 * ```javascript
 * // Get the Instance ID service for a given app
 * var otherInstanceId = admin.instanceId(otherApp);
 *```
 *
 * @param app - Optional app whose `InstanceId` service to
 *   return. If not provided, the default `InstanceId` service will be
 *   returned.
 *
 * @returns The default `InstanceId` service if
 *   no app is provided or the `InstanceId` service associated with the
 *   provided app.
 */
export declare function instanceId(app?: App): instanceId.InstanceId;
export declare namespace instanceId {
    /**
     * Type alias to {@link firebase-admin.instance-id#InstanceId}.
     */
    type InstanceId = TInstanceId;
}
