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
import { App } from '../app';
import { ListVersionsOptions, ListVersionsResult, ServerTemplate, RemoteConfigTemplate, ServerConfig, GetServerTemplateOptions, InitServerTemplateOptions, FetchResponseData } from './remote-config-api';
/**
 * The Firebase `RemoteConfig` service interface.
 */
export declare class RemoteConfig {
    readonly app: App;
    private readonly client;
    /**
     * Gets the current active version of the {@link RemoteConfigTemplate} of the project.
     *
     * @returns A promise that fulfills with a `RemoteConfigTemplate`.
     */
    getTemplate(): Promise<RemoteConfigTemplate>;
    /**
     * Gets the requested version of the {@link RemoteConfigTemplate} of the project.
     *
     * @param versionNumber - Version number of the Remote Config template to look up.
     *
     * @returns A promise that fulfills with a `RemoteConfigTemplate`.
     */
    getTemplateAtVersion(versionNumber: number | string): Promise<RemoteConfigTemplate>;
    /**
     * Validates a {@link RemoteConfigTemplate}.
     *
     * @param template - The Remote Config template to be validated.
     * @returns A promise that fulfills with the validated `RemoteConfigTemplate`.
     */
    validateTemplate(template: RemoteConfigTemplate): Promise<RemoteConfigTemplate>;
    /**
     * Publishes a Remote Config template.
     *
     * @param template - The Remote Config template to be published.
     * @param options - Optional options object when publishing a Remote Config template:
     *    - `force`: Setting this to `true` forces the Remote Config template to
     *      be updated and circumvent the ETag. This approach is not recommended
     *      because it risks causing the loss of updates to your Remote Config
     *      template if multiple clients are updating the Remote Config template.
     *      See {@link https://firebase.google.com/docs/remote-config/use-config-rest#etag_usage_and_forced_updates |
     *      ETag usage and forced updates}.
     *
     * @returns A Promise that fulfills with the published `RemoteConfigTemplate`.
     */
    publishTemplate(template: RemoteConfigTemplate, options?: {
        force: boolean;
    }): Promise<RemoteConfigTemplate>;
    /**
     * Rolls back a project's published Remote Config template to the specified version.
     * A rollback is equivalent to getting a previously published Remote Config
     * template and re-publishing it using a force update.
     *
     * @param versionNumber - The version number of the Remote Config template to roll back to.
     *    The specified version number must be lower than the current version number, and not have
     *    been deleted due to staleness. Only the last 300 versions are stored.
     *    All versions that correspond to non-active Remote Config templates (that is, all except the
     *    template that is being fetched by clients) are also deleted if they are more than 90 days old.
     * @returns A promise that fulfills with the published `RemoteConfigTemplate`.
     */
    rollback(versionNumber: number | string): Promise<RemoteConfigTemplate>;
    /**
     * Gets a list of Remote Config template versions that have been published, sorted in reverse
     * chronological order. Only the last 300 versions are stored.
     * All versions that correspond to non-active Remote Config templates (i.e., all except the
     * template that is being fetched by clients) are also deleted if they are older than 90 days.
     *
     * @param options - Optional options object for getting a list of versions.
     * @returns A promise that fulfills with a `ListVersionsResult`.
     */
    listVersions(options?: ListVersionsOptions): Promise<ListVersionsResult>;
    /**
     * Creates and returns a new Remote Config template from a JSON string.
     *
     * @param json - The JSON string to populate a Remote Config template.
     *
     * @returns A new template instance.
     */
    createTemplateFromJSON(json: string): RemoteConfigTemplate;
    /**
     * Instantiates {@link ServerTemplate} and then fetches and caches the latest
     * template version of the project.
     */
    getServerTemplate(options?: GetServerTemplateOptions): Promise<ServerTemplate>;
    /**
     * Synchronously instantiates {@link ServerTemplate}.
     */
    initServerTemplate(options?: InitServerTemplateOptions): ServerTemplate;
}
/**
 * Represents a fetch response that can be used to interact with RC's client SDK.
 */
export declare class RemoteConfigFetchResponse {
    private response;
    /**
     * @param app - The app for this RemoteConfig service.
     * @param serverConfig - The server config for which to generate a fetch response.
     * @param requestEtag - A request eTag with which to compare the current response.
     */
    constructor(app: App, serverConfig: ServerConfig, requestEtag?: string);
    /**
     * @returns JSON representation of the fetch response that can be consumed
     * by the RC client SDK.
     */
    toJSON(): FetchResponseData;
    private processEtag;
}
