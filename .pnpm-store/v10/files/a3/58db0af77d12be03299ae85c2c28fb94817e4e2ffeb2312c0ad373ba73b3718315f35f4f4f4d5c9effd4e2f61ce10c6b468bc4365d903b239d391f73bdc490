/*! firebase-admin v13.5.0 */
/*!
 * Copyright 2018 Google Inc.
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
import { AppMetadata, AppPlatform } from './app-metadata';
/**
 * Metadata about a Firebase Android App.
 */
export interface AndroidAppMetadata extends AppMetadata {
    platform: AppPlatform.ANDROID;
    /**
     * The canonical package name of the Android App, as would appear in the Google Play Developer
     * Console.
     *
     * @example
     * ```javascript
     * var packageName = androidAppMetadata.packageName;
     * ```
     */
    packageName: string;
}
/**
 * A reference to a Firebase Android app.
 *
 * Do not call this constructor directly. Instead, use {@link ProjectManagement.androidApp}.
 */
export declare class AndroidApp {
    readonly appId: string;
    private readonly requestHandler;
    private readonly resourceName;
    /**
     * Retrieves metadata about this Android app.
     *
     * @returns A promise that resolves to the retrieved metadata about this Android app.
     */
    getMetadata(): Promise<AndroidAppMetadata>;
    /**
     * Sets the optional user-assigned display name of the app.
     *
     * @param newDisplayName - The new display name to set.
     *
     * @returns A promise that resolves when the display name has been set.
     */
    setDisplayName(newDisplayName: string): Promise<void>;
    /**
     * Gets the list of SHA certificates associated with this Android app in Firebase.
     *
     * @returns The list of SHA-1 and SHA-256 certificates associated with this Android app in
     *     Firebase.
     */
    getShaCertificates(): Promise<ShaCertificate[]>;
    /**
     * Adds the given SHA certificate to this Android app.
     *
     * @param certificateToAdd - The SHA certificate to add.
     *
     * @returns A promise that resolves when the given certificate
     *     has been added to the Android app.
     */
    addShaCertificate(certificateToAdd: ShaCertificate): Promise<void>;
    /**
     * Deletes the specified SHA certificate from this Android app.
     *
     * @param certificateToDelete - The SHA certificate to delete.
     *
     * @returns A promise that resolves when the specified
     *     certificate has been removed from the Android app.
     */
    deleteShaCertificate(certificateToDelete: ShaCertificate): Promise<void>;
    /**
     * Gets the configuration artifact associated with this app.
     *
     * @returns A promise that resolves to the Android app's
     *     Firebase config file, in UTF-8 string format. This string is typically
     *     intended to be written to a JSON file that gets shipped with your Android
     *     app.
     */
    getConfig(): Promise<string>;
}
/**
 * A SHA-1 or SHA-256 certificate.
 *
 * Do not call this constructor directly. Instead, use
 * [`projectManagement.shaCertificate()`](projectManagement.ProjectManagement#shaCertificate).
 */
export declare class ShaCertificate {
    readonly shaHash: string;
    readonly resourceName?: string | undefined;
    /**
     * The SHA certificate type.
     *
     * @example
     * ```javascript
     * var certType = shaCertificate.certType;
     * ```
     */
    readonly certType: ('sha1' | 'sha256');
}
