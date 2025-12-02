/*! firebase-admin v13.5.0 */
/*!
 * Copyright 2020 Google Inc.
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
import { App } from '../app/index';
/**
 * The `InstanceId` service enables deleting the Firebase instance IDs
 * associated with Firebase client app instances.
 *
 * @deprecated Use {@link firebase-admin.installations#Installations} instead.
 */
export declare class InstanceId {
    private app_;
    /**
     * Deletes the specified instance ID and the associated data from Firebase.
     *
     * Note that Google Analytics for Firebase uses its own form of Instance ID to
     * keep track of analytics data. Therefore deleting a Firebase Instance ID does
     * not delete Analytics data. See
     * {@link https://firebase.google.com/support/privacy/manage-iids#delete_an_instance_id |
     * Delete an Instance ID}
     * for more information.
     *
     * @param instanceId - The instance ID to be deleted.
     *
     * @returns A promise fulfilled when the instance ID is deleted.
     */
    deleteInstanceId(instanceId: string): Promise<void>;
    /**
     * Returns the app associated with this InstanceId instance.
     *
     * @returns The app associated with this InstanceId instance.
     */
    get app(): App;
}
